import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isAuthorized, startHttpServer, type HttpHandle } from "../src/http";

const token = "t".repeat(32);
let http: HttpHandle | undefined;

function start(): HttpHandle {
  http = startHttpServer({
    host: "127.0.0.1",
    port: 0,
    token,
    createServer: () => {
      const server = new McpServer({ name: "test", version: "0.0.0" });
      server.registerTool("ping", { annotations: { readOnlyHint: true } }, () => ({
        content: [{ type: "text", text: "pong" }],
      }));
      return server;
    },
  });
  return http;
}

async function connect(
  url: string,
  bearer = token,
): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const client = new Client({ name: "http-test", version: "0.0.0" });
  await client.connect(transport);
  return { client, transport };
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "raw", version: "0" } },
};

afterEach(async () => {
  await http?.stop();
  http = undefined;
});

describe("isAuthorized", () => {
  test("accepts only the exact bearer token", () => {
    expect(isAuthorized(`Bearer ${token}`, token)).toBe(true);
    expect(isAuthorized(`bearer   ${token}`, token)).toBe(true);
    expect(isAuthorized(`Bearer ${token}x`, token)).toBe(false);
    expect(isAuthorized(token, token)).toBe(false);
    expect(isAuthorized("Bearer ", token)).toBe(false);
    expect(isAuthorized(null, token)).toBe(false);
  });
});

describe("startHttpServer", () => {
  test("answers health checks without a token", async () => {
    const { url } = start();
    const response = await fetch(url.replace("/mcp", "/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", sessions: 0 });
  });

  test("refuses requests without the right token", async () => {
    const { url } = start();
    const post = (headers: Record<string, string>) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...headers,
        },
        body: JSON.stringify(initialize),
      });
    const missing = await post({});
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");
    expect((await post({ Authorization: "Bearer wrong" })).status).toBe(401);
    await expect(connect(url, "wrong")).rejects.toThrow();
  });

  test("serves tools to separate sessions and ends them on request", async () => {
    const handle = start();
    const first = await connect(handle.url);
    const second = await connect(handle.url);
    expect(first.transport.sessionId).not.toBe(second.transport.sessionId);
    expect(handle.sessionCount()).toBe(2);

    const result = await first.client.callTool({ name: "ping", arguments: {} });
    expect(result.content).toEqual([{ type: "text", text: "pong" }]);
    expect((await second.client.listTools()).tools.map((tool) => tool.name)).toEqual(["ping"]);

    await first.transport.terminateSession();
    await Bun.sleep(10);
    expect(handle.sessionCount()).toBe(1);
    await second.client.close();
  });

  test("rejects unknown sessions and requests that don't start one", async () => {
    const { url, sessionCount } = start();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    const unknown = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Mcp-Session-Id": "nope" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect(unknown.status).toBe(404);

    const noSession = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect(noSession.status).toBe(400);
    expect((await fetch(url, { headers })).status).toBe(400);
    expect(sessionCount()).toBe(0);
  });

  test("returns 404 outside the MCP path", async () => {
    const { url } = start();
    expect((await fetch(url.replace("/mcp", "/other"))).status).toBe(404);
  });
});
