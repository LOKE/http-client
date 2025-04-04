import test, { TestContext } from "node:test";
import { AddressInfo } from "node:net";
import { text } from "node:stream/consumers";
import http from "node:http";
import assert from "node:assert/strict";

import promClient from "prom-client";

import { HTTPClient, registerMetrics } from ".";

registerMetrics(promClient.register);

async function setup(t: TestContext) {
  const server = http.createServer(async (req, res) => {
    const [, method, arg] = req.url?.split("/") ?? [];

    let result: unknown = null;

    switch (method) {
      case "ping":
        result = "pong";
        break;
      case "echo":
        result = {
          method: req.method,
          url: req.url,
          body: req.method === "POST" ? await text(req) : undefined,
        };
        break;
      case "drop":
        req.socket.destroy();
        return;
      case "error":
        res.writeHead(parseInt(arg), { "Content-Type": "text/plain" });
        res.end();
        return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });

  await new Promise<void>((resolve) => {
    server.listen({ port: 0, host: "127.0.0.1" }, () => {
      resolve();
    });
  });

  const { port, address } = server.address() as AddressInfo;

  t.after(() => {
    server.close();
  });

  return `http://${address}:${port}/`;
}

test("test", async (t: TestContext) => {
  const baseUrl = await setup(t);

  type Thing = { id: string; name: string };

  class TestClient extends HTTPClient {
    constructor() {
      super({ baseUrl, headers: {} });
    }

    ping(): Promise<string> {
      return this.request("GET", "ping");
    }

    getThing(id: string): Promise<Thing> {
      return this.request("GET", "echo/{id}", { id });
    }

    postThing(thing: Thing): Promise<Thing> {
      return this.request("POST", "echo", {}, thing);
    }

    drop(): Promise<void> {
      return this.request("GET", "drop");
    }

    error(code: number): Promise<void> {
      return this.request("GET", `error/${code}`);
    }
  }

  const tc = new TestClient();

  assert.equal(await tc.ping(), "pong");

  assert.deepEqual(await tc.getThing("123"), {
    method: "GET",
    url: "/echo/123",
  });

  assert.deepEqual(await tc.postThing({ id: "123", name: "test" }), {
    method: "POST",
    url: "/echo",
    body: '{"id":"123","name":"test"}',
  });

  await assert.rejects(tc.drop());

  await assert.rejects(tc.error(404), {
    status: 404,
  });
});
