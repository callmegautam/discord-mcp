import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import pkg from "../package.json" with { type: "json" };
import type { Client } from "discord.js";
import { loadConfig, type Config } from "./config";
import { createDiscordClient } from "./discord/client";
import { isGuildAllowed } from "./discord/resolve";
import { logger, setLogLevel } from "./lib/logger";
import { registerTools } from "./tools";

function checkAllowedGuilds(client: Client<true>, config: Config): void {
  if (config.allowedGuildIds.length === 0) return;

  const missing = config.allowedGuildIds.filter((id) => !client.guilds.cache.has(id));
  if (missing.length > 0) {
    throw new Error(`ALLOWED_GUILD_IDS has servers the bot is not in: ${missing.join(", ")}`);
  }

  const ignored = client.guilds.cache.filter((guild) => !isGuildAllowed(config.allowedGuildIds, guild.id));
  if (ignored.size > 0) {
    logger.info(
      `ignoring servers not in ALLOWED_GUILD_IDS: ${ignored.map((g) => `${g.name} (${g.id})`).join(", ")}`,
    );
  }
}

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  setLogLevel(config.logLevel);

  const client = await createDiscordClient(config.token, config);
  logger.info(`logged in as ${client.user.tag}, in ${client.guilds.cache.size} server(s)`);
  checkAllowedGuilds(client, config);

  const server = new McpServer({ name: "discord-mcp", version: pkg.version });
  const active = registerTools(server, { client, config });
  logger.info(`${active.length} tool(s) active${config.readOnly ? ", read-only mode" : ""}`);

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
