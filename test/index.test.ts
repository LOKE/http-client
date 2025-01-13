import test from "ava";
import express from "express";
import { HTTPClient } from "../src";
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
  if (id === "123" && name) {
    res.status(200).json({ id, name });
  } else {
    res.status(400).json({ error: "Invalid data" });
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
