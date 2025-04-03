# LOKE HTTP Client

## Usage

```js
const { HTTPClient } = require("@loke/http-client");

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
        console.error(
          "Unexpected status code",
          err.status,
          body.message,
        );
        throw err;
    }
  }
}
```

## Metrics

```js
const { HTTPClient, registerMetrics } = require("@loke/http-client");
const promClient = require("prom-client");
registerMetrics(promClient.register);
```

## Breaking Changes in v2

The main breaking change is the we switched from `got` to native node `fetch`
for the underlying HTTP client. This means that the API is now more aligned with
the native fetch API.

- The Response object is now from native `fetch` and not `got`
- Options are now native `fetch` options not `got` options
- Errors are now native `fetch` errors not `got` errors
- default `_handlerResponse` now returns the parsed body of the response
- Timout is no longer an option, pass a `signal` on the fetch options instead
- No longer supports the `retry` option, wrap your call to `request` in a retry
  loop instead
- No longer supports the `http_client_request_stage_duration_seconds` metric

Any project upgrading will have to to a fair bit of work, but it'll mostly be in
the `_handlerResponse` and `_handlerError` functions
