# LOKE HTTP Client

## Usage

```js
const { HTTPClient } = require("@loke/http-client");

class MyClient extends HTTPClient {}
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

- No longer supports the `http_client_request_stage_duration_seconds` metric
- The Response object is now from native `fetch` and not `got`
- Options are now native `fetch` options not `got` options
- Errors are now native `fetch` errors not `got` errors
- Timout is no longer an option, pass a `signal` on the fetch options instead
- No longer supports the `retry` option, wrap your call to `request` in a retry loop instead
