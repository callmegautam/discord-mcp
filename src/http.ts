import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { logger } from "./lib/logger";

export const MCP_PATH = "/mcp";
export const HEALTH_PATH = "/health";

// A client that disappears without ending its session would otherwise keep its server forever.
const SESSION_IDLE_MS = 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// Bun closes connections idle for 10 seconds by default, which would cut SSE streams between the
// transport's 15 second keep-alive frames.
const CONNECTION_IDLE_SECONDS = 120;

export interface HttpOptions {
  host: string;
  port: number;
  token: string;
  /** Builds a fresh MCP server for each session. */
  createServer: () => McpServer;
}

export interface HttpHandle {
  url: string;
  sessionCount: () => number;
  stop: () => Promise<void>;
}

interface Session {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  lastSeen: number;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Checks an Authorization header against the token in constant time. */
export function isAuthorized(header: string | null, token: string): boolean {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return false;
  // Hashing first gives both sides the same length, which timingSafeEqual needs.
  return timingSafeEqual(digest(match[1].trim()), digest(token));
}

function jsonError(status: number, message: string, headers: Record<string, string> = {}): Response {
  return Response.json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }, { status, headers });
}

export function startHttpServer({ host, port, token, createServer }: HttpOptions): HttpHandle {
  const sessions = new Map<string, Session>();

  const closeSession = async (id: string): Promise<void> => {
    const session = sessions.get(id);
    if (!session) return;
    sessions.delete(id);
    await session.server
      .close()
      .catch((error: unknown) => logger.warn(`closing session ${id}: ${String(error)}`));
  };

  const openSession = async (request: Request): Promise<Response> => {
    const server = createServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { server, transport, lastSeen: Date.now() });
        logger.info(`session ${id} opened, ${sessions.size} active`);
      },
      onsessionclosed: (id) => {
        void closeSession(id);
        logger.info(`session ${id} closed by the client`);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    // Anything but an initialize request is refused without a session, so drop the unused server.
    if (!transport.sessionId) await server.close();
    return response;
  };

  const handleMcp = async (request: Request): Promise<Response> => {
    if (!isAuthorized(request.headers.get("authorization"), token)) {
      return jsonError(401, "Missing or wrong bearer token.", {
        "WWW-Authenticate": 'Bearer realm="discord-mcp"',
      });
    }
    const sessionId = request.headers.get("mcp-session-id");
    if (!sessionId) {
      if (request.method !== "POST")
        return jsonError(400, "Start a session with an initialize request first.");
      return openSession(request);
    }
    const session = sessions.get(sessionId);
    if (!session) return jsonError(404, "Unknown or expired session, initialize a new one.");
    session.lastSeen = Date.now();
    return session.transport.handleRequest(request);
  };

  const server = Bun.serve({
    hostname: host,
    port,
    idleTimeout: CONNECTION_IDLE_SECONDS,
    async fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === HEALTH_PATH && request.method === "GET") {
        return Response.json({ status: "ok", sessions: sessions.size });
      }
      if (pathname !== MCP_PATH) return new Response("Not found", { status: 404 });
      try {
        return await handleMcp(request);
      } catch (error) {
        logger.error(`http request failed: ${error instanceof Error ? error.message : String(error)}`);
        return jsonError(500, "Internal server error.");
      }
    },
  });

  const sweep = setInterval(() => {
    const cutoff = Date.now() - SESSION_IDLE_MS;
    for (const [id, session] of sessions) {
      if (session.lastSeen < cutoff) {
        logger.info(`session ${id} idle for too long, closing it`);
        void closeSession(id);
      }
    }
  }, SWEEP_INTERVAL_MS);
  sweep.unref();

  return {
    url: `http://${host}:${server.port}${MCP_PATH}`,
    sessionCount: () => sessions.size,
    async stop() {
      clearInterval(sweep);
      await Promise.all([...sessions.keys()].map(closeSession));
      await server.stop(true);
    },
  };
}
