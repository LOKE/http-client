# LOKE HTTP Client

## Usage

```ts
import { HTTPClient, HTTPResponseError } from "@loke/http-client";

class MyClient extends HTTPClient {
  constructor() {
    super({ baseUrl: "https://example.com/" });
  }

  getThing(id) {
    return this.request("GET", "/thing/{id}", { id });
  }

  async _handlerResponse(res: Response) {
    // This is the default implementation. It will parse the response body as
    // JSON if the content type is application/json and return the body as an
    // object. If the content type is not application/json, it will return the
    // response as a string.
    //
    // You may want to override this if you want to do something with headers
    // or if you want to handle different content types
    let body = undefined;
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      body = await res.json();
    }

    return { body };
  }

  async _handlerError(err: unknown): Promise<void> {
    // HTTPResponseError is thrown when there was a successful response but the
    // status code is not in the 2xx range
    //
    // Other errors are thrown when there was a network error or the request
    // was aborted.
    //
    // Usually you only want to map HTTPResponseError errors in in the 4xx range
    if (!(err instanceof HTTPResponseError)) {
      throw err;
    }

    let body = undefined;
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      body = await res.json();
    }

    switch (err.status) {
      case 404:
        throw new ThingNotFoundError(body.message);
      default:
        console.error("Unexpected status code", err.status, body.message);
        throw err;
    }
  }
}
```

## Error Handling

If `fetch` throws an error, it will be passed to `_handlerError`. This is
usually a network error or an abort error.

If the response is not in the 2xx range, a `HTTPResponseError` will be thrown.
This is a subclass of `Error` and has the following properties:

- `message`: The status text of the response
- `status`: The status code of the response
- `response`: The original response object

## Metrics

```js
import { HTTPClient, registerMetrics } from "@loke/http-client";
import promClient from "prom-client";

registerMetrics(promClient.register);
```

## Breaking Changes in v2

The main breaking change is the we switched from `got` to native node `fetch`
for the underlying HTTP client. This means that the API is now more aligned with
the native fetch API.

- The Response object is now from native `fetch` and not `got`
- Options are now native `fetch` options not `got` options
- Errors are now either native `fetch` errors or `HTTPResponseError`, not `got`
  errors. Notably `got` errors have `statusCode` as a property, but the
  `HTTPResponseError` has `status` as a property. All other properties are now
  found under `response`
- default `_handlerResponse` now returns the parsed body of the response
- Timeout is no longer an option, pass a `signal` on the fetch options instead
- No longer supports the `retry` option, wrap your call to `request` in a retry
  loop instead
- No longer supports the `http_client_request_stage_duration_seconds` metric

Any project upgrading will have to to a fair bit of work, but it'll mostly be in
the `_handlerResponse` and `_handlerError` functions
