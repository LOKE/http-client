import type { IncomingHttpHeaders } from "node:http";

declare class StdError extends Error {
  code?: string | undefined;
  host?: string | undefined;
  hostname?: string | undefined;
  method?: string | undefined;
  path?: string | undefined;
  protocol?: string | undefined;
  url?: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- This is a generic error
  response?: any;
}

declare class RequestError extends StdError {
  name: "RequestError";
}

declare class ReadError extends StdError {
  name: "ReadError";
}

declare class ParseError extends StdError {
  name: "ParseError";
  statusCode: number;
  statusMessage: string;
}

declare class HTTPError extends StdError {
  name: "HTTPError";
  statusCode: number;
  statusMessage: string;
  headers: IncomingHttpHeaders;
  body: Buffer | string | object;
}

declare class MaxRedirectsError extends StdError {
  name: "MaxRedirectsError";
  statusCode: number;
  statusMessage: string;
  redirectUrls: string[];
}

declare class UnsupportedProtocolError extends StdError {
  name: "UnsupportedProtocolError";
}

declare class CancelError extends StdError {
  name: "CancelError";
}

declare class TimeoutError extends StdError {
  name: "TimeoutError";
  event: TimeoutEvent;
}

export type LokeError =
  | RequestError
  | ReadError
  | ParseError
  | HTTPError
  | MaxRedirectsError
  | UnsupportedProtocolError
  | CancelError
  | TimeoutError;
