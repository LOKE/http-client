import type { IncomingHttpHeaders } from "node:http";

export type TimeoutEvent =
  | "request"
  | "response"
  | "read"
  | "socket"
  | "lookup"
  | "connect";

export class StdError extends Error {
  code?: string;
  host?: string;
  hostname?: string;
  method?: string;
  path?: string;
  protocol?: string;
  url?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- This is a generic error
  response?: any;
}

export class RequestError extends StdError {
  name: "RequestError" = "RequestError";
}

export class ReadError extends StdError {
  name: "ReadError" = "ReadError";
}

export class ParseError extends StdError {
  name: "ParseError" = "ParseError";
  statusCode: number;
  statusMessage: string;

  constructor(
    message: string,
    statusCode: number,
    statusMessage: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.statusMessage = statusMessage;
  }
}

export class HTTPError extends StdError {
  name: "HTTPError" = "HTTPError";
  statusCode: number;
  statusMessage: string;
  headers: IncomingHttpHeaders;
  body: Buffer | string | object | null;

  constructor(
    message: string,
    response: Response,
    body: Buffer | string | object
  ) {
    super(message);
    this.statusCode = response.status;
    this.statusMessage = response.statusText;
    this.headers = response.headers as unknown as IncomingHttpHeaders;
    this.body = body;
  }
}

export class UnsupportedProtocolError extends StdError {
  name: "UnsupportedProtocolError" = "UnsupportedProtocolError";
}

export class CancelError extends StdError {
  name: "CancelError" = "CancelError";
}

export class TimeoutError extends StdError {
  name: "TimeoutError" = "TimeoutError";
  event: TimeoutEvent;

  constructor(message: string, event: TimeoutEvent) {
    super(message);
    this.event = event;
  }
}

export type LokeError =
  | RequestError
  | ReadError
  | ParseError
  | HTTPError
  | UnsupportedProtocolError
  | CancelError
  | TimeoutError;
