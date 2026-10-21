import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import pkg from "../package.json" with { type: "json" };
import { loadConfig } from "./config";
import { createDiscordClient } from "./discord/client";
import { logger, setLogLevel } from "./lib/logger";
import { registerTools } from "./tools";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  setLogLevel(config.logLevel);

  const client = await createDiscordClient(config.token);
  logger.info(`logged in as ${client.user.tag}, in ${client.guilds.cache.size} server(s)`);

  const server = new McpServer({ name: "discord-mcp", version: pkg.version });
  registerTools(server, { client, config });

  let shuttingDown = false;
  const shutdown = async (reason: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`shutting down (${reason})`);
    await server.close();
    await client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  // The Discord gateway keeps the process alive, so exit when the MCP client goes away.
  process.stdin.on("close", () => void shutdown("stdin closed"));

  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
