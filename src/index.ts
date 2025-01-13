import {
  requestsCount,
  requestDuration,
  requestStageDuration,
} from "./metrics";
import { parseUrlTemplate } from "./utils";

interface Headers {
  [header: string]: number | string | string[] | undefined;
}

interface Options {
  baseUrl: string;
  headers: Headers;
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
  | "OPTIONS"
  | "TRACE"
  | "CONNECT";

export class HTTPClient {
  baseUrl: string;
  headers: Headers;

  constructor(opts: Options) {
    const { baseUrl, headers } = opts;
    this.baseUrl = baseUrl;
    this.headers = headers;
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
    };

    const fetchOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url.toString(), fetchOptions);
      const endTime = performance.now();

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          errorBody || response.statusText || "Request failed"
        );
      }

      const responseBody = response.headers
        .get("content-type")
        ?.includes("application/json")
        ? await response.json()
        : await response.text();

      const result: Result = {
        statusCode: response.status,
        body: responseBody,
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

      return this._handlerError(error as Error);
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
