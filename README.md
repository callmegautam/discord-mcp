# discord-mcp

A self-hosted [MCP](https://modelcontextprotocol.io) server that lets an AI assistant (Claude Code, Claude Desktop, any MCP client) manage a Discord server through your own bot. It runs locally in Docker, talks to Discord with your bot token, and nothing else.

Built with TypeScript, [discord.js](https://discord.js.org), the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and [Bun](https://bun.sh).

## Tools

| Tool                        | What it does                                                              |
| --------------------------- | ------------------------------------------------------------------------- |
| `list_guilds`               | Servers the bot is in                                                     |
| `get_guild`                 | Server details: owner, member count, verification, boosts                 |
| `list_channels`             | All channels and categories                                               |
| `create_channel`            | Create a text, voice, announcement, stage or forum channel, or a category |
| `edit_channel`              | Change name, topic, slowmode, age restriction, category or position       |
| `delete_channel`            | Delete a channel or category                                              |
| `clone_channel`             | Copy a channel with its settings and permission overwrites                |
| `list_channel_permissions`  | Permission overwrites on a channel or category                            |
| `set_channel_permission`    | Allow, deny or reset permissions for a role or member on a channel        |
| `remove_channel_permission` | Remove a role's or member's overwrite from a channel                      |
| `list_roles`                | All roles with permissions, highest first                                 |
| `list_role_members`         | Members who have a role, in pages of up to 1000                           |
| `create_role`               | Create a role with a color, permissions and sidebar display               |
| `edit_role`                 | Change name, color, sidebar display, mentionability or permissions        |
| `delete_role`               | Delete a role                                                             |
| `move_role`                 | Place a role directly above or below another role                         |
| `list_members`              | Members in pages of up to 1000                                            |
| `get_member`                | One member with roles and timeout status                                  |
| `search_members`            | Members whose username or nickname starts with a query                    |
| `set_nickname`              | Set or clear a member's nickname, or the bot's own                        |
| `add_member_role`           | Give a member a role                                                      |
| `remove_member_role`        | Take a role away from a member                                            |
| `kick_member`               | Remove a member from the server                                           |
| `ban_user`                  | Ban a user, member or not, and optionally delete up to 7 days of messages |
| `unban_user`                | Lift a ban                                                                |
| `list_bans`                 | Banned users with the ban reason, in pages of up to 1000                  |
| `timeout_member`            | Time out a member for up to 28 days                                       |
| `remove_timeout`            | End a timeout early                                                       |
| `get_audit_log`             | Audit log entries, filtered by action and by who did it                   |

Every tool takes an optional `guild_id`. Without it, the server uses `DISCORD_GUILD_ID`, or the only server the bot is in.

Every write tool takes an optional `reason` that shows up in the server audit log. Message tools are coming, see [CHANGELOG.md](CHANGELOG.md).

## Safety

The bot can only do what its Discord permissions allow. These settings narrow that down further:

| Variable            | What it does                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `READ_ONLY`         | `true` registers only tools marked `readOnlyHint`. Nothing that can change the server is exposed. |
| `ALLOWED_GUILD_IDS` | Comma separated server IDs. Other servers the bot is in are hidden and refused.                   |
| `DISABLED_TOOLS`    | Comma separated tool names to switch off, for example `list_members,get_member`.                  |

A typo in any of them stops the server at startup instead of being silently ignored: an unknown tool name, an ID that is not a server the bot is in, or a `DISCORD_GUILD_ID` that is not on the allowlist.

Every tool declares MCP annotations, and startup refuses a tool that doesn't: `readOnlyHint` on all of them, `destructiveHint` on anything that writes, and a `reason` argument for the audit log on anything destructive. Read-only mode is driven by those same annotations, so it can't drift from what the client is told.

Write tools check permissions and role order before calling Discord. When the bot lacks a permission, or a role or member sits at or above the bot's highest role, the error says which one and how to fix it instead of returning a bare 403.

## Setup

### 1. Create the bot

1. Create an application at https://discord.com/developers/applications and add a bot under the **Bot** tab.
2. Copy the bot token.
3. Under **Privileged Gateway Intents**, enable **Server Members Intent**.
4. Invite the bot from **OAuth2 > URL Generator** with the `bot` scope and the permissions you want it to have. The channel tools need **Manage Channels**, the permission overwrite and role tools need **Manage Roles**, and the moderation tools need **Kick Members**, **Ban Members**, **Moderate Members** (timeouts), **Manage Nicknames** and **View Audit Log**. Discord only lets the bot give out permissions it has itself, unless it is an Administrator.
5. In your server settings, drag the bot's role above any role you want it to manage. Role tools refuse roles at or above the bot's highest role, and roles managed by an integration. Moderation tools refuse members whose highest role is at or above the bot's, and the server owner.

### 2. Configure

```sh
cp .env.example .env
chmod 600 .env
```

Put the token in `.env`:

```sh
DISCORD_TOKEN=your-bot-token
DISCORD_GUILD_ID=optional-default-server-id
ALLOWED_GUILD_IDS=
READ_ONLY=false
DISABLED_TOOLS=
LOG_LEVEL=info
```

See [Safety](#safety) for the three middle settings.

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
  discord/          Discord client, guild resolution, permission checks, response shaping
  tools/            one file per tool group, registered in tools/index.ts, policy.ts
                    enforces annotations, READ_ONLY and DISABLED_TOOLS
  lib/              logger, shared schemas, tool result helpers
tests/              bun test suites
```

stdout carries the MCP protocol. Log through `src/lib/logger.ts`, which writes to stderr, never with `console.log`.

## License

[MIT](LICENSE)
