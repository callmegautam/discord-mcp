# discord-mcp

A self-hosted [MCP](https://modelcontextprotocol.io) server that lets an AI assistant (Claude Code, Claude Desktop, any MCP client) manage a Discord server through your own bot. It runs locally in Docker, talks to Discord with your bot token, and nothing else.

Built with TypeScript, [discord.js](https://discord.js.org), the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and [Bun](https://bun.sh).

## Tools

| Tool            | What it does                                              |
| --------------- | --------------------------------------------------------- |
| `list_guilds`   | Servers the bot is in                                     |
| `get_guild`     | Server details: owner, member count, verification, boosts |
| `list_channels` | All channels and categories                               |
| `list_roles`    | All roles with permissions, highest first                 |
| `list_members`  | Members in pages of up to 1000                            |
| `get_member`    | One member with roles and timeout status                  |

Every tool takes an optional `guild_id`. Without it, the server uses `DISCORD_GUILD_ID`, or the only server the bot is in.

All tools in this version are read-only. Management tools (channels, roles, moderation, messages) are coming, see [CHANGELOG.md](CHANGELOG.md).

## Setup

### 1. Create the bot

1. Create an application at https://discord.com/developers/applications and add a bot under the **Bot** tab.
2. Copy the bot token.
3. Under **Privileged Gateway Intents**, enable **Server Members Intent**.
4. Invite the bot from **OAuth2 > URL Generator** with the `bot` scope and the permissions you want it to have.
5. In your server settings, drag the bot's role above any role you want it to manage.

### 2. Configure

```sh
cp .env.example .env
chmod 600 .env
```

Put the token in `.env`:

```sh
DISCORD_TOKEN=your-bot-token
DISCORD_GUILD_ID=optional-default-server-id
LOG_LEVEL=info
```

`.env` is git ignored and docker ignored. The token is passed to the container at runtime and is never baked into the image.

### 3. Build

```sh
docker build -t discord-mcp .
```

### 4. Connect it to Claude Code

```sh
claude mcp add discord -s user -- docker run --rm -i --env-file /absolute/path/to/discord-mcp/.env discord-mcp
```

Run `/mcp` in Claude Code to confirm it is connected.

For other MCP clients, use the same command:

```json
{
  "mcpServers": {
    "discord": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "--env-file", "/absolute/path/to/discord-mcp/.env", "discord-mcp"]
    }
  }
}
```

## Development

Requires Bun 1.4 or newer.

```sh
bun install
bun run dev        # run locally with watch mode, reads .env automatically
bun run check      # typecheck, lint, format check and tests
```

To try the tools by hand, use the MCP inspector:

```sh
bunx @modelcontextprotocol/inspector bun run src/index.ts
```

### Layout

```
src/
  index.ts          entry point: config, Discord login, MCP over stdio
  config.ts         environment validation
  discord/          Discord client, guild resolution, response shaping
  tools/            one file per tool group, registered in tools/index.ts
  lib/              logger, shared schemas, tool result helpers
tests/              bun test suites
```

stdout carries the MCP protocol. Log through `src/lib/logger.ts`, which writes to stderr, never with `console.log`.

## License

[MIT](LICENSE)
