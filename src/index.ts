import {
  HTTPError,
  MaxRedirectsError,
  ParseError,
  RequestError,
  TimeoutError,
  UnsupportedProtocolError,
  type TimeoutEvent,
} from "./errors";
export * from "./errors";
import {
  requestDuration,
  requestsCount,
  requestStageDuration,
} from "./metrics";
import { parseUrlTemplate } from "./url-template";
export { registerMetrics } from "./metrics";

interface Headers {
  [header: string]: number | string | string[] | undefined;
}

interface Options {
  baseUrl: string;
  headers: Headers;
  timeout?: number;
  maxRedirects?: number;
}

interface Timings {
  start?: number;
  socket?: number;
  lookup?: number;
  connect?: number;
  upload?: number;
  response?: number;
  end?: number;
  error?: number;
  phases: {
    wait?: number;
    dns?: number;
    tcp?: number;
    request?: number;
    firstByte?: number;
    download?: number;
    total?: number;
  };
}

interface Result {
  timings?: Timings;
  statusCode?: number;
  body?: unknown;
}

type Method =
  | "GET"
  | "PUT"
  | "POST"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export class HTTPClient {
  baseUrl: string;
  headers: Headers;
  timeout: number;
  maxRedirects: number;

  constructor(opts: Options) {
    const {
      baseUrl,
      headers,
      timeout = 10000,
      maxRedirects = 5,
    } = opts;

    // Validate protocol
    const supportedProtocols = ["http:", "https:"];
    const url = new URL(baseUrl);
    if (!supportedProtocols.includes(url.protocol)) {
      throw new UnsupportedProtocolError(
        `Unsupported protocol: ${baseUrl}`
      );
    }

    this.baseUrl = baseUrl;
    this.headers = headers;
    this.timeout = timeout;
    this.maxRedirects = maxRedirects;
  }

  async request(
    method: Method,
    pathTemplate: string,
    params = {},
    body?: unknown,
    options?: RequestInit
  ): Promise<Result> {
    const path = parseUrlTemplate(pathTemplate);
    const url = new URL(path.expand(params), this.baseUrl);

    const startTime = performance.now();

    const defaultOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    };

    const fetchOptions = { ...defaultOptions, ...options };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.timeout);

      fetchOptions.signal = controller.signal;

      const response = await fetch(url.toString(), fetchOptions);
      clearTimeout(timeoutId);

      const endTime = performance.now();

      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get("Location");
        if (!redirectUrl) {
          throw new HTTPError(
            "Redirect with no Location header",
            response,
            ""
          );
        }
        if (this.maxRedirects <= 0) {
          throw new MaxRedirectsError(
            "Maximum redirects exceeded",
            response.status,
            response.statusText,
            [redirectUrl]
          );
        }
        this.maxRedirects--;
        return this.request(
          method,
          redirectUrl,
          params,
          body,
          options
        );
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new HTTPError(
          errorBody || response.statusText || "Request failed",
          response,
          errorBody
        );
      }

      const responseBody = await this.parseResponseBody(response);

      const result: Result = {
        statusCode: response.status,
        body: responseBody === "" ? undefined : responseBody,
        timings: {
          phases: {
            total: endTime - startTime,
          },
        },
      };

      this.recordMetrics(result, method, pathTemplate);

      return this._handlerResponse(result);
    } catch (error) {
      const endTime = performance.now();
      const result: Result = {
        statusCode: 0,
        timings: {
          phases: {
            total: endTime - startTime,
          },
        },
      };

      this.recordMetrics(result, method, pathTemplate);

      return this._handlerError(
        error as Error,
        method,
        url.toString()
      );
    }
  }

  private async parseResponseBody(
    response: Response
  ): Promise<unknown> {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json") && response.body) {
      try {
        return await response.json();
      } catch {
        throw new ParseError(
          "Failed to parse JSON response",
          response.status,
          response.statusText
        );
      }
    } else {
      return await response.text();
    }
  }

  private recordMetrics(
    result: Result,
    method: string,
    pathTemplate: string
  ) {
    const stopTimer = requestDuration.startTimer();
    stopTimer({ method, path: pathTemplate, base: this.baseUrl });

    if (result.timings?.phases) {
      for (const [stage, value] of Object.entries(
        result.timings.phases
      )) {
        if (stage === "total") continue;
        if (typeof value !== "number") continue;

        requestStageDuration.observe(
          { stage, base: this.baseUrl },
          value / 1000
        );
      }
    }

    requestsCount.inc({
      method,
      path: pathTemplate,
      code: result.statusCode || -1,
      base: this.baseUrl,
    });
  }

  protected _handlerResponse(res: Result): Result {
    return res;
  }

  protected _handlerError(
    err: Error,
    method: string,
    url: string
  ): never {
    if (err.name === "AbortError") {
      throw new TimeoutError(
        `Request timed out after ${this.timeout}ms`,
        "request" as TimeoutEvent
      );
    }

    if (
      err instanceof HTTPError ||
      err instanceof MaxRedirectsError ||
      err instanceof ParseError
    ) {
      throw err;
    }

    if (
      err instanceof TypeError &&
      err.message.includes("Failed to fetch")
    ) {
      const requestError = new RequestError(err.message);
      requestError.method = method;
      requestError.url = url;
      throw requestError;
    }

    const unknownError = new RequestError(err.message);
    unknownError.method = method;
    unknownError.url = url;
    throw unknownError;
  }
}
