import test from "ava";
import express from "express";
import { HTTPClient } from ".";
import type { Server } from "node:http";

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

app.post("/users", (req, res) => {
  const { name, email } = req.body;
  if (name && email) {
    res.status(201).json({ id: "124", name, email });
  } else {
    res.status(400).json({ error: "Invalid data" });
  }
});

app.put("/users/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  // Check for non-existent user first
  if (id !== "123") {
    res.status(404).json({ error: "User not found" });
  } else if (!name) {
    res.status(400).json({ error: "Invalid data" });
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
    res.status(400).json({ error: "Invalid data" });
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
app.trace("/trace", (req, res) => {
  res.status(200).json({ method: req.method, headers: req.headers });
});

// CONNECT: Simulate a tunneling endpoint
app.connect("/tunnel", (req, res) => {
  res.status(200).json({ message: "Tunnel established" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Test lifecycle: Start and stop the server
test.before(async () => {
  server = app.listen(4000);
  client = new HTTPClient({
    baseUrl: `${BASE_URL}:4000`,
    headers: { Authorization: "Bearer token" },
  });
});

test.after(async () => {
  server.close();
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
  t.is(error.message, '{"error":"User not found"}');
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
  t.is(error.message, '{"error":"Not Found"}');
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
  t.is(error.message, '{"error":"Invalid data"}');
});

test("HTTPClient handles missing body on POST", async (t) => {
  const error = await t.throwsAsync(
    client.request("POST", "/users", {})
  );
  t.is(error.message, '{"error":"Invalid data"}');
});

test("HTTPClient handles POST request to invalid URL", async (t) => {
  const error = await t.throwsAsync(
    client.request("POST", "/invalid/path", {}, { name: "Test User" })
  );
  t.is(error.message, '{"error":"Not Found"}');
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
  t.is(error.message, '{"error":"Invalid data"}');
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
  t.is(error.message, '{"error":"User not found"}');
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
  t.is(error.message, '{"error":"Not Found"}');
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
  t.is(error.message, '{"error":"User not found"}');
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
  t.is(error.message, '{"error":"User not found"}');
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
  t.is(error.message, "Not Found");
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
  t.is(error.message, '{"error":"Not Found"}');
});
