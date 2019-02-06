import got from "got";
import { Counter, Histogram } from "prom-client";
import { resolve as resolveUrl } from "url";
import urlTemplate from "url-template";

const requestsCount = new Counter(
  "http_client_requests_total",
  "Total number of http client requests",
  ["base", "method", "path", "code"]
);

const requestDuration = new Histogram(
  "http_client_request_duration_seconds",
  "Latencies for http client requests",
  ["base", "method", "path"]
);

const requestStageDuration = new Histogram(
  "http_client_request_stage_duration_seconds",
  "Latencies for http client requests",
  ["base", "stage"]
);

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

const parseUrlTemplate = memoize((pathTemplate: string) =>
  urlTemplate.parse(pathTemplate)
);

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
}

type RequestOptions = got.GotOptions<string | null>;

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
  headers: Headers;
  /**
   * Create a HTTPClient
   * @param  {string} baseUrl base url to use for each request
   * @param  {Object} headers headers to attach to each request
   */
  constructor(opts: Options) {
    const { baseUrl, headers } = opts;
    this.baseUrl = baseUrl;
    this.headers = headers;
    // this.agent = agent;
  }

  /**
   * execute request based an path template and params,
   * Note that the path is always appended to the baseUrl, a leading /
   * does not eliminate the path from the baseUrl.
   * @param  {string} method       http method
   * @param  {string} pathTemplate RFC 6570 path template string
   * @param  {Object} [params={}]  parameters to be injected into pathTemplate
   * @param  {Object} [body]       body that will be json encoded and sent
   * @return {Promise<Result>}     result of request, (after passing through handlers)
   */
  request(
    method: Method,
    pathTemplate: string,
    params = {},
    body?: {},
    options?: RequestOptions
  ) {
    const path = parseUrlTemplate(pathTemplate);
    const url = resolveUrl(this.baseUrl, path.expand(params));

    const stopTimer = requestDuration.startTimer();

    const recordDone = (result: Result) => {
      stopTimer({ method, path: pathTemplate, base: this.baseUrl });

      if (result.timings) {
        for (const [stage, value] of Object.entries(result.timings.phases)) {
          if (stage === "total") { continue; }
          if (typeof value !== "number") { continue; }

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
        base: this.baseUrl
      });
    };

    const defaultOptions: got.GotJSONOptions = {
      method: method.toUpperCase(),
      body,
      headers: Object.assign({}, this.headers),
      json: true,
      retry: 0,
      timeout: 60000
      //   agent: this.agent
    };

    return got(url, Object.assign(defaultOptions, options)).then(
      (res: any) => {
        recordDone(res);
        return this._handlerResponse(res);
      },
      (err: got.GotError) => {
        recordDone(err.response || err);
        return this._handlerError(err);
      }
    );
  }

  /**
   * map response to result (for overloading)
   * @param  {Object} res http response
   * @return {(Result|Promise<Result>)}
   */
  _handlerResponse(res: any) {
    return res;
  }

  /**
   * map response error to result (for overloading)
   * @param  {Object} err            error from http response
   * @param  {Object} err.statusCode http status code
   * @param  {Object} err.response   original http response
   * @return {(Result|Promise<Result>)}
   */
  _handlerError(err: Error) {
    throw err;
  }
}
