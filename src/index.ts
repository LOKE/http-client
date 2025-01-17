import {
  HTTPError,
  ParseError,
  RequestError,
  TimeoutError,
  UnsupportedProtocolError,
} from "./errors";
import {
  requestDuration,
  requestsCount,
  requestStageDuration,
} from "./metrics";
import { parseUrlTemplate } from "./url-template";
export * from "./errors";
export { registerMetrics } from "./metrics";

interface Headers {
  [header: string]: number | string | string[] | undefined;
}

interface Options {
  baseUrl: string;
  headers: Headers;
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
  maxRedirects: number;

  constructor(opts: Options) {
    const { baseUrl, headers, maxRedirects = 5 } = opts;

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
      redirect: "follow",
    };

    const fetchOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url.toString(), fetchOptions);

      const endTime = performance.now();

      if (!response.ok) {
        const errorBody = response.body
          ? response.headers
              .get("content-type")
              ?.includes("application/json")
            ? await response.json()
            : await response.text()
          : null;

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

      if (!(error instanceof Error)) {
        return this._handlerError(new Error("Unknown error"));
      }

      if (error instanceof HTTPError || error instanceof ParseError) {
        return this._handlerError(error);
      }

      if (
        error instanceof DOMException &&
        error.name === "TimeoutError"
      ) {
        return this._handlerError(new TimeoutError(error.message));
      }

      if (
        error instanceof TypeError &&
        error.cause instanceof Error
      ) {
        return this._handlerError(error.cause);
      }

      const errorCause = error.cause?.toString();
      // Handle "maximum redirect reached" error
      if (
        errorCause?.includes("ENOTFOUND") ||
        errorCause?.includes("ECONNREFUSED")
      ) {
        const requestError = new RequestError(error.message);
        requestError.method = method;
        requestError.url = url.toString();
        return this._handlerError(requestError);
      }

      return this._handlerError(error);
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

  protected _handlerError(err: Error): never {
    throw err;
  }
}
