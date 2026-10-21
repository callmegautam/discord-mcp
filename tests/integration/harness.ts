import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Integration tests only run through `bun run test:integration`, never as part of `bun test`. */
export const enabled = process.env["INTEGRATION"] === "1";

// The tests create and delete real channels, roles and messages, so they refuse anything that
// looks like a real community instead of a throwaway test server.
const MAX_MEMBERS = 10;

/** Names of everything the tests create start with this, so leftovers from a failed run can be swept. */
export const PREFIX = "mcpit";

export function testGuildId(): string {
  const id = process.env["INTEGRATION_GUILD_ID"];
  if (!id) throw new Error("Set INTEGRATION_GUILD_ID to the ID of a throwaway test server.");
  return id;
}

export class ToolError extends Error {
  override name = "ToolError";
}

export interface TestServer {
  call<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>;
  /** Calls a tool that is expected to fail and returns its error text. */
  fail(name: string, args?: Record<string, unknown>): Promise<string>;
  client: Client;
  close(): Promise<void>;
}

function text(result: CallToolResult): string {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("");
}

/** Starts the real server over stdio, locked to the test server through ALLOWED_GUILD_IDS. */
export async function startServer(env: Record<string, string> = {}): Promise<TestServer> {
  const guildId = testGuildId();
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "src/index.ts"],
    env: {
      ...(process.env as Record<string, string>),
      DISCORD_GUILD_ID: guildId,
      ALLOWED_GUILD_IDS: guildId,
      READ_ONLY: "false",
      DISABLED_TOOLS: "",
      MESSAGE_CONTENT: "false",
      LOG_LEVEL: "warn",
      ...env,
    },
    stderr: "inherit",
  });
  const client = new Client({ name: "integration-tests", version: "0.0.0" });
  await client.connect(transport);

  const raw = async (name: string, args: Record<string, unknown>) =>
    (await client.callTool({ name, arguments: args })) as CallToolResult;

  const server: TestServer = {
    client,
    async call<T>(name: string, args: Record<string, unknown> = {}) {
      const result = await raw(name, args);
      if (result.isError) throw new ToolError(`${name} failed: ${text(result)}`);
      return JSON.parse(text(result)) as T;
    },
    async fail(name, args = {}) {
      const result = await raw(name, args);
      if (!result.isError) throw new Error(`${name} was expected to fail but returned ${text(result)}`);
      return text(result);
    },
    close: () => client.close(),
  };

  const guild = await server.call<{ id: string; memberCount: number }>("get_guild");
  if (guild.id !== guildId || guild.memberCount > MAX_MEMBERS) {
    await server.close();
    throw new Error(
      `Refusing to run: the test server has ${guild.memberCount} members, more than ${MAX_MEMBERS}. Use a throwaway server.`,
    );
  }
  return server;
}
