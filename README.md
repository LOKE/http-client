# LOKE HTTP Client

## Usage

```js
const { HTTPClient } = require("@loke/http-client");

class MyClient extends HTTPClient {
  // TODO
}
```

## Metrics

```js
const { HTTPClient, registerMetrics } = require("@loke/http-client");
const promClient = require("prom-client");
registerMetrics(promClient.register);
```
