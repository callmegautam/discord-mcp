import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "../package.json" with { type: "json" };
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";
import { registerTools } from "./tools";
import type { ToolContext } from "./tools/context";

/** An MCP server with every tool, resource and prompt registered and the tool policy applied. */
export function createMcpServer(ctx: ToolContext): { server: McpServer; tools: string[] } {
  const server = new McpServer({ name: "discord-mcp", version: pkg.version });
  const tools = registerTools(server, ctx);
  registerResources(server, ctx);
  registerPrompts(server, ctx);
  return { server, tools };
}
