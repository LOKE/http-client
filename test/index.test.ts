import test from "ava";
import express from "express";
import { HTTPClient } from "../src";
import type { Server } from "node:http";

const BASE_URL = "http://localhost";
let server: Server;

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

app.get("/metrics", (req, res) => {
  res.status(200).json({ success: true });
});

// Test lifecycle: Start and stop the server
test.before(async () => {
  server = app.listen(4000);
});

test.after(async () => {
  server.close();
});

// Tests
test("HTTPClient performs a GET request and returns data", async (t) => {
  const pathTemplate = "/users/{id}";
  const params = { id: "123" };

  const client = new HTTPClient({
    baseUrl: `${BASE_URL}:4000`,
    headers: { Authorization: "Bearer token" },
  });

  const result = await client.request("GET", pathTemplate, params);

  t.is(result.statusCode, 200);
  t.deepEqual(result.body, { id: "123", name: "John Doe" });
});

test("HTTPClient handles 404 errors", async (t) => {
  const pathTemplate = "/users/{id}";
  const params = { id: "999" };

  const client = new HTTPClient({
    baseUrl: `${BASE_URL}:4000`,
    headers: { Authorization: "Bearer token" },
  });

  const error = await t.throwsAsync(
    client.request("GET", pathTemplate, params)
  );

  t.is(error.message, '{"error":"User not found"}');
});

test("HTTPClient performs a POST request with a body", async (t) => {
  const pathTemplate = "/users";
  const body = { name: "Jane Doe", email: "jane.doe@example.com" };

  const client = new HTTPClient({
    baseUrl: `${BASE_URL}:4000`,
    headers: { Authorization: "Bearer token" },
  });

  const result = await client.request("POST", pathTemplate, {}, body);

  t.is(result.statusCode, 201);
  t.deepEqual(result.body, {
    id: "124",
    name: "Jane Doe",
    email: "jane.doe@example.com",
  });
});

test("HTTPClient records metrics", async (t) => {
  const pathTemplate = "/metrics";

  const client = new HTTPClient({
    baseUrl: `${BASE_URL}:4000`,
    headers: {},
  });

  const result = await client.request("GET", pathTemplate);

  t.is(result.statusCode, 200);
  t.deepEqual(result.body, { success: true });
});
