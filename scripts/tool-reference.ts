import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Client as DiscordClient } from "discord.js";
import prettier from "prettier";
import { loadConfig } from "../src/config";
import { TOOL_GROUPS } from "../src/tools";
import type { ToolContext } from "../src/tools/context";

export const REFERENCE_PATH = "docs/tools.md";

interface JsonSchema {
  type?: string;
  description?: string;
  enum?: unknown[];
  anyOf?: JsonSchema[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  default?: unknown;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

const SNOWFLAKE_PATTERN = "^\\d{17,20}$";
const COLOR_PATTERN = "^#?[0-9a-fA-F]{6}$";
const MAX_LISTED_VALUES = 8;

function range(min: number | undefined, max: number | undefined, unit: string): string {
  if (min !== undefined && max !== undefined && max <= Number.MAX_SAFE_INTEGER) {
    return min === max ? `exactly ${max} ${unit}` : `${min} to ${max} ${unit}`;
  }
  if (max !== undefined && max <= Number.MAX_SAFE_INTEGER) return `up to ${max} ${unit}`;
  if (min !== undefined && min > 0) return `at least ${min} ${unit}`;
  return "";
}

function withDetail(base: string, detail: string): string {
  return detail ? `${base}, ${detail}` : base;
}

function describeType(schema: JsonSchema): string {
  if (schema.anyOf) return schema.anyOf.map(describeType).join(" or ");
  if (schema.enum) {
    if (schema.enum.length > MAX_LISTED_VALUES) return "name";
    return schema.enum.map((value) => `\`${String(value)}\``).join(", ");
  }
  switch (schema.type) {
    case "null":
      return "null";
    case "string":
      if (schema.pattern === SNOWFLAKE_PATTERN) return "ID";
      if (schema.pattern === COLOR_PATTERN) return "hex color";
      if (schema.format === "uri") return "URL";
      if (schema.format === "date-time") return "ISO 8601 time";
      return withDetail("string", range(schema.minLength, schema.maxLength, "characters"));
    case "integer":
    case "number":
      return withDetail(schema.type, range(schema.minimum, schema.maximum, "").trim());
    case "array": {
      const items = schema.items ?? {};
      const plurals: Record<string, string> = { object: "objects", ID: "IDs", name: "names" };
      const item = items.type === "object" ? "object" : describeType(items);
      const of = plurals[item] ?? item;
      return withDetail(`list of ${of}`, range(schema.minItems, schema.maxItems, "items"));
    }
    case "object":
      return "object";
    default:
      return schema.type ?? "any";
  }
}

function cell(text: string): string {
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function inputRows(schema: JsonSchema, prefix = ""): string[] {
  const required = new Set(schema.required ?? []);
  const rows: string[] = [];
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    if (!prefix && name === "guild_id") continue;
    const description = property.description ?? property.anyOf?.find((s) => s.description)?.description ?? "";
    const defaulted =
      property.default !== undefined ? ` Default \`${JSON.stringify(property.default)}\`.` : "";
    const path = `${prefix}${name}`;
    rows.push(
      `| \`${path}\` | ${cell(describeType(property))} | ${required.has(name) ? "yes" : ""} | ${cell(description + defaulted)} |`,
    );
    const nested = property.type === "array" ? property.items : property;
    if (nested?.type === "object")
      rows.push(...inputRows(nested, property.type === "array" ? `${path}[].` : `${path}.`));
  }
  return rows;
}

function behavior(tool: Tool): string {
  const { readOnlyHint, destructiveHint } = tool.annotations ?? {};
  if (readOnlyHint) return "Read-only.";
  if (destructiveHint) return "Destructive, hidden when `READ_ONLY=true`.";
  return "Writes, hidden when `READ_ONLY=true`.";
}

function renderTool(tool: Tool): string {
  const rows = inputRows(tool.inputSchema as JsonSchema);
  const inputs = rows.length
    ? ["| Input | Type | Required | Description |", "| --- | --- | --- | --- |", ...rows].join("\n")
    : `No inputs${tool.inputSchema.properties?.["guild_id"] ? " besides `guild_id`" : ""}.`;
  return [`### \`${tool.name}\``, `${tool.description ?? ""}`, behavior(tool), inputs].join("\n\n");
}

async function listGroupTools(register: (server: McpServer, ctx: ToolContext) => void): Promise<Tool[]> {
  const server = new McpServer({ name: "discord-mcp", version: "0.0.0" });
  register(server, { client: {} as DiscordClient<true>, config: loadConfig({ DISCORD_TOKEN: "unused" }) });
  const client = new Client({ name: "tool-reference", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();
  await client.close();
  return tools;
}

/** Builds the Markdown tool reference from the schemas the server sends to MCP clients. */
export async function renderToolReference(): Promise<string> {
  const sections: string[] = [];
  const index: string[] = [];
  for (const group of TOOL_GROUPS) {
    const tools = await listGroupTools(group.register);
    index.push(`- ${group.title}: ${tools.map((tool) => `[\`${tool.name}\`](#${tool.name})`).join(", ")}`);
    sections.push(`## ${group.title}`, ...tools.map(renderTool));
  }

  const markdown = [
    "# Tool reference",
    "This file is generated from the tool schemas by `bun run docs:tools`. Edit the tool definitions in `src/tools/`, not this file.",
    "Every tool takes an optional `guild_id`. Without it, the server uses `DISCORD_GUILD_ID`, or the only server the bot is in. IDs are Discord snowflakes passed as strings.",
    index.join("\n"),
    ...sections,
  ].join("\n\n");

  const options = await prettier.resolveConfig(REFERENCE_PATH);
  return prettier.format(markdown, { ...options, parser: "markdown" });
}

if (import.meta.main) {
  await Bun.write(REFERENCE_PATH, await renderToolReference());
  process.stderr.write(`wrote ${REFERENCE_PATH}\n`);
}
