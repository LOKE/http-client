import { resolve as resolveUrl } from "node:url";
import { Counter, Histogram, Metric } from "prom-client";
import urlTemplate from "url-template";

export class HTTPResponseError extends Error {
  status: number;
  response: Response;

  constructor(message: string, response: Response) {
    super(message);
    this.status = response.status;
    this.response = response;
  }
}

const requestsCount = new Counter({
  name: "http_client_requests_total",
  help: "Total number of http client requests",
  labelNames: ["base", "method", "path", "code"],
  registers: [],
});

const requestDuration = new Histogram({
  name: "http_client_request_duration_seconds",
  help: "Latencies for http client requests",
  labelNames: ["base", "method", "path"],
  registers: [],
});

type Registry = {
  registerMetric(metric: Metric): void;
};

export function registerMetrics(registry: Registry) {
  registry.registerMetric(requestsCount);
  registry.registerMetric(requestDuration);
}

function memoize<K, V>(fn: (key: K) => V): (key: K) => V {
  const cache = new Map<K, V>();

  return (key: K) => {
    if (cache.has(key)) {
      return cache.get(key) as V;
    }

    const val = fn(key);
    cache.set(key, val);

    return val;
  };
}

type Expander = {
  expand(parameters: unknown): string;
};

type Parse = (pathTemplate: string) => Expander;

type Options = {
  baseUrl: string;
  headers?: Record<string, string> | Headers;
};

export const parseUrlTemplate: Parse = memoize((pathTemplate: string) =>
  urlTemplate.parse(pathTemplate),
);

/**
 * Class that can be usefully extended to abstract calls to a http apis.
 * @example
 * class ExampleCient extends HTTPClient {
 *   constructor() {
 *     super({ baseUrl: 'https://example.com/'});
 *   }
 *   getThing(id) {
 *     return this.request('GET', '/thing/{id}', {id});
 *   }
 * }
 */
export class HTTPClient {
  baseUrl: string;
  headers?: Record<string, string> | Headers;

  constructor(opts: Options) {
    const { baseUrl, headers } = opts;
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  /**
   * execute request based an path template and params,
   * Note that the path is always appended to the baseUrl, a leading /
   * does not eliminate the path from the baseUrl.
   * @param method http method
   * @param pathTemplate RFC 6570 path template string
   * @param params parameters to be injected into pathTemplate
   * @param body body that will be json encoded and sent
   * @param options options to be passed to fetch
   */
  async request(
    method: string,
    pathTemplate: string,
    params: unknown = {},
    body?: unknown,
    options?: RequestInit,
  ) {
    const path = parseUrlTemplate(pathTemplate);
    const url = resolveUrl(this.baseUrl, path.expand(params));

    const stopTimer = requestDuration.startTimer();

    const recordDone = (res: { status: number }) => {
      stopTimer({ method, path: pathTemplate, base: this.baseUrl });

      requestsCount.inc({
        method,
        path: pathTemplate,
        code: res.status,
        base: this.baseUrl,
      });
    };

    const headers = new Headers(this.headers);
    if (body) {
      headers.set("Content-Type", "application/json");
    }

    const defaultOptions: RequestInit = {
      method: method.toUpperCase(),
      body: body ? JSON.stringify(body) : undefined,
      headers: headers,
    };

    let res: Response;
    try {
      res = await fetch(url, Object.assign(defaultOptions, options));
    } catch (err: unknown) {
      recordDone({ status: -1 });
      return this._handlerError(err);
    }

    recordDone(res);

    if (!res.ok) {
      const err = new HTTPResponseError(res.statusText, res);
      return this._handlerError(err);
    }

    return this._handlerResponse(res);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async _handlerResponse(res: Response): Promise<any> {
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return res.json();
    }

    return res.text();
  }

  _handlerError(err: unknown) {
    throw err;
  }
}
