import test from "ava";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  HTTPClient,
  HTTPError,
  ParseError,
  UnsupportedProtocolError,
} from ".";

const BASE_URL = "http://localhost";
let server: Server;
let client: HTTPClient;

// Set up the Express faux server
const app = express();
app.use(express.json());

// Mock API endpoints
app.get("/users/:id", (req, res) => {
  const { id } = req.params;
  if (id === "123") {
    res.status(200).json({ id, name: "John Doe" });
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

app.get("/redirect", (req, res) => {
  res.redirect(301, "/users/123");
});

app.get("/invalid-json", (req, res) => {
  res.set("Content-Type", "application/json").send("Invalid JSON");
});

app.get("/redirect-loop", (req, res) => {
  res.redirect(301, "/redirect-loop"); // Infinite redirect loop
});

app.post("/users", (req, res) => {
  const { name, email } = req.body;
  if (name && email) {
    res.status(201).json({ id: "124", name, email });
  } else {
    res.status(400).json({ error: "Invalid Data" });
  }
});

app.put("/users/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  // Check for non-existent user first
  if (id !== "123") {
    res.status(404).json({ error: "User not found" });
  } else if (!name) {
    res.status(400).json({ error: "Invalid Data" });
  } else {
    res.status(200).json({ id, name });
  }
});

app.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  if (id === "123") {
    res.status(204).send();
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

app.get("/metrics", (req, res) => {
  res.status(200).json({ success: true });
});

app.patch("/users/:id", (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  if (id === "123" && email) {
    res.status(200).json({ id, email });
  } else if (id !== "123") {
    res.status(404).json({ error: "User not found" });
  } else {
    res.status(400).json({ error: "Invalid Data" });
  }
});

// HEAD: Check if a user exists
app.head("/users/:id", (req, res) => {
  const { id } = req.params;
  if (id === "123") {
    res.status(200).send();
  } else {
    res.status(404).send();
  }
});

// OPTIONS: Return allowed methods for a route
app.options("/users", (req, res) => {
  res
    .set("Allow", "GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD")
    .send();
});

// TRACE: Echo back the request details
app.get("/redirect-no-location", (req, res) => {
  res.status(301).send("Redirect without Location header");
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

let PORT: number;

// Test lifecycle: Start and stop the server
test.before(async () => {
  server = app.listen();

  // Check if server.address() is of type AddressInfo
  const address = server.address();
  if (typeof address === "object" && address !== null) {
    const { port } = address as AddressInfo;
    PORT = port;
    client = new HTTPClient({
      baseUrl: `${BASE_URL}:${port}`,
      headers: { Authorization: "Bearer token" },
    });
  } else {
    throw new Error("Failed to retrieve server address");
  }
});

test.after.always(async () => {
  return new Promise<void>((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
});

// GET Tests
test("HTTPClient performs a GET request and returns data", async (t) => {
  const result = await client.request("GET", "/users/{id}", {
    id: "123",
  });
  t.is(result.statusCode, 200);
  t.deepEqual(result.body, { id: "123", name: "John Doe" });
});

test("HTTPClient handles 404 errors on GET", async (t) => {
  const error = await t.throwsAsync(
    client.request("GET", "/users/{id}", { id: "999" })
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 404);
  t.is(error.statusMessage, "Not Found");
  t.deepEqual(error.body, {
    error: "User not found",
  });
});

test("HTTPClient performs a GET request for metrics", async (t) => {
  const result = await client.request("GET", "/metrics");
  t.is(result.statusCode, 200);
  t.deepEqual(result.body, { success: true });
});

test("HTTPClient handles invalid URL on GET", async (t) => {
  const error = await t.throwsAsync(
    client.request("GET", "/invalid/path")
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 404);
  t.is(error.statusMessage, "Not Found");
  t.deepEqual(error.body, {
    error: "Not Found",
  });
});

test("HTTPClient handles redirects correctly", async (t) => {
  const result = await client.request("GET", "/redirect");
  t.is(result.statusCode, 200);
  t.deepEqual(result.body, { id: "123", name: "John Doe" });
});

// POST Tests
test("HTTPClient performs a POST request with a body", async (t) => {
  const result = await client.request(
    "POST",
    "/users",
    {},
    { name: "Jane Doe", email: "jane.doe@example.com" }
  );
  t.is(result.statusCode, 201);
  t.deepEqual(result.body, {
    id: "124",
    name: "Jane Doe",
    email: "jane.doe@example.com",
  });
});

test("HTTPClient handles 400 errors on POST", async (t) => {
  const error = await t.throwsAsync(
    client.request("POST", "/users", {}, { name: "" })
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 400);
  t.is(error.statusMessage, "Bad Request");
  t.deepEqual(error.body, {
    error: "Invalid Data",
  });
});

test("HTTPClient handles missing body on POST", async (t) => {
  const error = await t.throwsAsync(
    client.request("POST", "/users", {})
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 400);
  t.is(error.statusMessage, "Bad Request");
  t.deepEqual(error.body, {
    error: "Invalid Data",
  });
});

test("HTTPClient handles POST request to invalid URL", async (t) => {
  const error = await t.throwsAsync(
    client.request("POST", "/invalid/path", {}, { name: "Test User" })
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 404);
  t.is(error.statusMessage, "Not Found");
  t.deepEqual(error.body, {
    error: "Not Found",
  });
});

// PUT Tests
test("HTTPClient performs a PUT request to update data", async (t) => {
  const result = await client.request(
    "PUT",
    "/users/{id}",
    { id: "123" },
    { name: "Updated Name" }
  );
  t.is(result.statusCode, 200);
  t.deepEqual(result.body, { id: "123", name: "Updated Name" });
});

test("HTTPClient handles 400 errors on PUT", async (t) => {
  const error = await t.throwsAsync(
    client.request("PUT", "/users/{id}", { id: "123" }, {})
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 400);
  t.is(error.statusMessage, "Bad Request");
  t.deepEqual(error.body, {
    error: "Invalid Data",
  });
});

test("HTTPClient handles PUT request to a non-existent user", async (t) => {
  const error = await t.throwsAsync(
    client.request(
      "PUT",
      "/users/{id}",
      { id: "999" },
      { name: "Updated Name" }
    )
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 404);
  t.is(error.statusMessage, "Not Found");
  t.deepEqual(error.body, {
    error: "User not found",
  });
});

test("HTTPClient handles PUT request to invalid URL", async (t) => {
  const error = await t.throwsAsync(
    client.request(
      "PUT",
      "/invalid/path",
      {},
      { name: "Invalid Request" }
    )
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.deepEqual(error.body, { error: "Not Found" });
});

// DELETE Tests
test("HTTPClient performs a DELETE request", async (t) => {
  const result = await client.request("DELETE", "/users/{id}", {
    id: "123",
  });
  t.is(result.statusCode, 204);
  t.is(result.body, undefined);
});

test("HTTPClient handles 404 errors on DELETE", async (t) => {
  const error = await t.throwsAsync(
    client.request("DELETE", "/users/{id}", { id: "999" })
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 404);
  t.is(error.statusMessage, "Not Found");
  t.deepEqual(error.body, {
    error: "User not found",
  });
});

// Metrics Test
test("HTTPClient records metrics", async (t) => {
  const result = await client.request("GET", "/metrics");
  t.is(result.statusCode, 200);
  t.deepEqual(result.body, { success: true });
});

// PATCH Tests
test("HTTPClient performs a PATCH request to update email", async (t) => {
  const result = await client.request(
    "PATCH",
    "/users/{id}",
    { id: "123" },
    { email: "new.email@example.com" }
  );
  t.is(result.statusCode, 200);
  t.deepEqual(result.body, {
    id: "123",
    email: "new.email@example.com",
  });
});

test("HTTPClient handles 404 errors on PATCH", async (t) => {
  const error = await t.throwsAsync(
    client.request(
      "PATCH",
      "/users/{id}",
      { id: "999" },
      { email: "test@example.com" }
    )
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 404);
  t.is(error.statusMessage, "Not Found");
  t.deepEqual(error.body, {
    error: "User not found",
  });
});

// HEAD Tests
test("HTTPClient performs a HEAD request to check user existence", async (t) => {
  const result = await client.request("HEAD", "/users/{id}", {
    id: "123",
  });
  t.is(result.statusCode, 200);
  t.is(result.body, undefined); // HEAD responses have no body
});

test("HTTPClient handles 404 errors on HEAD", async (t) => {
  const error = await t.throwsAsync(
    client.request("HEAD", "/users/{id}", { id: "999" })
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 404);
  t.is(error.statusMessage, "Not Found");
});

// OPTIONS Tests
test("HTTPClient performs an OPTIONS request", async (t) => {
  const result = await client.request("OPTIONS", "/users");
  t.is(result.statusCode, 200);
  t.is(result.body, undefined); // OPTIONS responses typically have no body
});

test("HTTPClient handles OPTIONS request for invalid URL", async (t) => {
  const error = await t.throwsAsync(
    client.request("OPTIONS", "/invalid/path")
  );
  if (!(error instanceof HTTPError))
    return t.fail("Error is not an instance of HTTPError");
  t.is(error.statusCode, 404);
  t.is(error.statusMessage, "Not Found");
  t.deepEqual(error.body, {
    error: "Not Found",
  });
});

// Specific Error Testing
test("HTTPClient handles request timeout", async (t) => {
  const slowApp = express();
  slowApp.get("/slow", async (_, res) => {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Simulate delay
    res.status(200).send("Success");
  });

  const slowServer = slowApp.listen(4001);
  const slowClient = new HTTPClient({
    baseUrl: "http://localhost:4001",
    headers: { Authorization: "Bearer token" },
  });

  const error = await t.throwsAsync(
    slowClient.request("GET", "/slow", {}, undefined, {
      signal: AbortSignal.timeout(100),
    })
  );
  t.is(error.name, "TimeoutError");
  t.is(error.message, "The operation was aborted due to timeout");

  slowServer.close();
});

test("HTTPClient throws RequestError on network failure", async (t) => {
  const faultyClient = new HTTPClient({
    baseUrl: "http://invalid.url", // Invalid base URL
    headers: { Authorization: "Bearer token" },
  });

  const error = await t.throwsAsync(
    faultyClient.request("GET", "/invalid/path")
  );

  t.true(error instanceof Error);
  t.is(error.message, "getaddrinfo ENOTFOUND invalid.url");
});

test("HTTPClient throws ParseError on invalid JSON response", async (t) => {
  app.get("/invalid-json", (req, res) => {
    res.set("Content-Type", "application/json").send("Invalid JSON");
  });

  const error = await t.throwsAsync(
    client.request("GET", "/invalid-json")
  );
  t.true(error instanceof ParseError);
  t.is(error.message, "Failed to parse JSON response");
});

test("HTTPClient throws MaxRedirectsError on excessive redirects", async (t) => {
  const loopingClient = new HTTPClient({
    baseUrl: `${BASE_URL}:${PORT}`,
    headers: { Authorization: "Bearer token" },
    maxRedirects: 2, // Low limit to trigger the error quickly
  });

  const error = await t.throwsAsync(
    loopingClient.request("GET", "/redirect-loop")
  );
  t.true(error instanceof Error);
  t.is(error.message, "redirect count exceeded");
});

test("HTTPClient handles 301 response without Location header", async (t) => {
  const error = await t.throwsAsync(
    client.request("GET", "/redirect-no-location")
  );

  t.true(error instanceof HTTPError);
  if (!(error instanceof HTTPError)) return;
  t.is(error.statusCode, 301);
  t.is(error.message, "Redirect without Location header");
});

test("HTTPClient throws UnsupportedProtocolError on unsupported protocol", async (t) => {
  const error = t.throws(() => {
    new HTTPClient({
      baseUrl: "ftp://localhost", // Unsupported protocol
      headers: { Authorization: "Bearer token" },
    });
  });

  t.true(error instanceof UnsupportedProtocolError);
  t.is(error.message, "Unsupported protocol: ftp://localhost");
});
