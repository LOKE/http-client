# HTTP Client with Metrics

This repository provides a simple yet powerful HTTP client for making requests, measuring performance, and recording metrics for observability. The implementation includes support for custom headers, URL templating, and Prometheus metrics.

## Features

- **Customizable HTTP requests** with support for all common HTTP methods.
- **Metrics tracking** for request counts, durations, and stage-specific timings.
- **URL templating** for dynamic path construction.
- **Error handling** with structured response objects.
- **Memoization** for efficient URL template parsing.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
  - [Creating an HTTP Client](#creating-an-http-client)
  - [Making Requests](#making-requests)
  - [Metrics Integration](#metrics-integration)

## Installation

Install the dependencies using npm:

```bash
npm install
```

## Usage

### Creating an HTTP Client

Create an instance of `HTTPClient` with a base URL and default headers:

```typescript
import { HTTPClient } from './index';

const client = new HTTPClient({
  baseUrl: 'https://api.example.com',
  headers: {
    Authorization: 'Bearer YOUR_API_KEY',
  },
});
```

### Making Requests

Use the `request` method to send HTTP requests. Supported methods include `GET`, `POST`, `PUT`, `DELETE`, and more.

```typescript
(async () => {
  try {
    const result = await client.request('GET', '/users/{id}', { id: 123 });
    console.log(result);
  } catch (error) {
    console.error('Request failed:', error);
  }
})();
```

### Metrics Integration

The `metrics.ts` file provides Prometheus-compatible metrics tracking for HTTP requests. To register the metrics with your Prometheus client, use the `registerMetrics` function.

```typescript
import { registerMetrics } from './metrics';
import { Registry } from 'prom-client';

const registry = new Registry();
registerMetrics(registry);
```

Expose these metrics in your application for monitoring:

```typescript
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});
```
