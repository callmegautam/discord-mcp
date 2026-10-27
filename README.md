# discord-mcp

A self-hosted [MCP](https://modelcontextprotocol.io) server that lets an AI assistant (Claude Code, Claude Desktop, any MCP client) manage a Discord server through your own bot. It runs locally in Docker, talks to Discord with your bot token, and nothing else.

Built with TypeScript, [discord.js](https://discord.js.org), the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and [Bun](https://bun.sh).

## Tools

| Tool                        | What it does                                                              |
| --------------------------- | ------------------------------------------------------------------------- |
| `list_guilds`               | Servers the bot is in                                                     |
| `get_guild`                 | Server details: owner, member count, verification, boosts                 |
| `edit_guild`                | Change name, icon, verification level or system channel                   |
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
| `list_messages`             | Messages in a channel, newest first, in pages of up to 100                |
| `get_message`               | One message with embeds, attachments and reactions                        |
| `send_message`              | Send text and embeds, optionally as a reply                               |
| `edit_message`              | Change the text or embeds of a message the bot sent                       |
| `delete_message`            | Delete a message                                                          |
| `bulk_delete_messages`      | Delete up to 100 messages under 14 days old, by ID or the most recent     |
| `list_pinned_messages`      | Pinned messages in a channel                                              |
| `pin_message`               | Pin a message                                                             |
| `unpin_message`             | Unpin a message                                                           |
| `add_reaction`              | React to a message as the bot                                             |
| `remove_reaction`           | Remove the bot's or another user's reaction                               |
| `clear_reactions`           | Remove all reactions, or all of one emoji                                 |
| `list_reactions`            | Users who reacted with an emoji                                           |
| `list_threads`              | Active threads and forum posts, or a channel's archived ones              |
| `create_thread`             | Start a thread in a text or announcement channel, from a message or not   |
| `create_forum_post`         | Start a forum post with a first message and tags                          |
| `edit_thread`               | Rename, archive, reopen, lock, retag or set slowmode on a thread          |
| `delete_thread`             | Delete a thread or forum post                                             |
| `list_invites`              | Active invites with uses and expiry                                       |
| `create_invite`             | Create an invite link to a channel                                        |
| `delete_invite`             | Revoke an invite                                                          |
| `list_webhooks`             | Webhooks in the server or a channel, without their secret URLs            |
| `create_webhook`            | Create a webhook and return its URL                                       |
| `delete_webhook`            | Delete a webhook                                                          |
| `list_emojis`               | Custom emojis                                                             |
| `create_emoji`              | Upload a custom emoji from an image URL                                   |
| `delete_emoji`              | Delete a custom emoji                                                     |
| `list_stickers`             | Custom stickers                                                           |
| `create_sticker`            | Upload a custom sticker from a file URL                                   |
| `delete_sticker`            | Delete a custom sticker                                                   |
| `list_scheduled_events`     | Upcoming and running events with interest counts                          |
| `create_scheduled_event`    | Schedule a voice, stage or external event                                 |
| `edit_scheduled_event`      | Change an event, or start, end or cancel it                               |
| `delete_scheduled_event`    | Delete an event                                                           |
| `audit_permissions`         | Flag risky permission setups, with a severity and a suggested fix         |
| `export_template`           | Turn the server's roles, categories and channels into a JSON template     |
| `apply_template`            | Create the roles, categories and channels a template describes            |

Every tool's inputs, types and limits are listed in the [tool reference](docs/tools.md).

Every tool takes an optional `guild_id`. Without it, the server uses `DISCORD_GUILD_ID`, or the only server the bot is in.

Every write tool takes an optional `reason` that shows up in the server audit log. Discord keeps no audit log entry for editing a message or removing reactions, so for those tools the reason only goes to this server's log on stderr.

`send_message` doesn't let `@everyone`, `@here` or role mentions ping anyone unless `allow_mass_mentions` is true.

The message tools also work inside threads and forum posts, pass the thread ID as `channel_id`.

Webhook URLs contain a secret token, so `list_webhooks` leaves them out and only `create_webhook` returns the URL of the webhook it made. `create_emoji`, `create_sticker`, `create_webhook` and `edit_guild` take https URLs only, the file is downloaded and checked against Discord's size limit before it is uploaded.

## Resources

| Resource                               | What it holds                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `discord://guilds/{guild_id}/snapshot` | A server's settings, roles with permissions and member counts, and channels with their permission overwrites, as JSON |

The client can attach a snapshot to the conversation, so the assistant knows the server's layout without a chain of tool calls. One snapshot is listed per server the bot is in, limited to `ALLOWED_GUILD_IDS`.

## Prompts

| Prompt                     | What it does                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `audit_server_permissions` | Runs `audit_permissions`, explains each finding and proposes fixes as tool calls, without applying them     |
| `setup_community_server`   | Drafts roles, categories and channels for a described community, dry runs them and applies them after a yes |

`audit_permissions` checks for dangerous permissions on `@everyone`, server wide and in channel overwrites, roles and bots with Administrator, staff or log channels that everyone can see, verification level, content filter and moderator 2FA, and powerful roles the bot sits below. It only reads, so it stays available in read-only mode. `setup_community_server` is left out when `READ_ONLY` is on or `apply_template` is disabled.

## Templates

A template is one JSON object that describes a layout. Overwrites refer to roles by name, so the same template works on any server:

```json
{
  "roles": [
    {
      "name": "Moderator",
      "color": "#e67e22",
      "hoist": true,
      "permissions": ["KickMembers", "ManageMessages"]
    },
    { "name": "Member" }
  ],
  "categories": [
    {
      "name": "Staff",
      "overwrites": [
        { "role": "@everyone", "deny": ["ViewChannel"] },
        { "role": "Moderator", "allow": ["ViewChannel"] }
      ],
      "channels": [{ "name": "mod-log" }, { "name": "mod-chat" }]
    },
    {
      "name": "Community",
      "channels": [
        { "name": "general", "topic": "Say hi" },
        { "name": "Lounge", "type": "voice" }
      ]
    }
  ],
  "channels": [{ "name": "welcome" }]
}
```

`apply_template` only adds. Roles, categories and channels whose name already exists are skipped, and nothing is edited or deleted, so running it twice is safe. The whole template is checked before the first change: unknown roles in overwrites, duplicate names, fields a channel type doesn't have, Community-only channel types, and permissions the bot doesn't hold itself all fail with one error listing every problem. `dry_run: true` reports what would be created and skipped without changing anything.

Roles are listed highest first and keep that order, placed just above `@everyone`. A channel without overwrites takes its category's permissions, and a channel with overwrites gets the category's plus its own, its own winning for the same role.

`export_template` turns a server into a template, to save the layout to a file or copy it to another server. Bot roles, member overwrites and channel types templates don't cover are left out and listed in `notes`.

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
3. Under **Privileged Gateway Intents**, enable **Server Members Intent**. To let the message tools read what other users wrote, also enable **Message Content Intent** and set `MESSAGE_CONTENT=true`. Without it every other tool works, and messages from other users come back with empty content.
4. Invite the bot from **OAuth2 > URL Generator** with the `bot` scope and the permissions you want it to have. The channel tools need **Manage Channels**, the permission overwrite and role tools need **Manage Roles**, the moderation tools need **Kick Members**, **Ban Members**, **Moderate Members** (timeouts), **Manage Nicknames** and **View Audit Log**, the message tools need **View Channel**, **Read Message History**, **Send Messages**, **Embed Links**, **Add Reactions**, **Pin Messages** and **Manage Messages** (deleting other users' messages, bulk deletes, removing other users' reactions), the thread tools need **Create Public Threads**, **Create Private Threads**, **Send Messages in Threads** and **Manage Threads**, `edit_guild` and `list_invites` need **Manage Server**, `create_invite` needs **Create Invite**, the webhook tools need **Manage Webhooks**, the emoji and sticker tools need **Create Expressions** and **Manage Expressions** (deleting ones the bot didn't upload), and the event tools need **Create Events** and **Manage Events** (changing events the bot didn't create). Discord only lets the bot give out permissions it has itself, unless it is an Administrator.
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
MESSAGE_CONTENT=false
DISABLED_TOOLS=
LOG_LEVEL=info
```

See [Safety](#safety) for `ALLOWED_GUILD_IDS`, `READ_ONLY` and `DISABLED_TOOLS`. `MESSAGE_CONTENT=true` requests the Message Content intent at login, which fails if it is not enabled in the developer portal.

`.env` is git ignored and docker ignored. The token is passed to the container at runtime and is never baked into the image.

### 3. Get the image

Pull the published image from GitHub Container Registry:

```sh
docker pull ghcr.io/callmegautam/discord-mcp:1
```

Images are tagged with the full version (`1.3.0`), the minor (`1.3`), the major (`1`) and `latest`, for `linux/amd64` and `linux/arm64`.

Or build it yourself from a checkout:

```sh
docker build -t discord-mcp .
```

The commands below use the published image, replace it with `discord-mcp` if you built your own.

### 4. Connect it to Claude Code

```sh
claude mcp add discord -s user -- docker run --rm -i --env-file /absolute/path/to/discord-mcp/.env ghcr.io/callmegautam/discord-mcp:1
```

Run `/mcp` in Claude Code to confirm it is connected.

For other MCP clients, use the same command:

```json
{
  "mcpServers": {
    "discord": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--env-file",
        "/absolute/path/to/discord-mcp/.env",
        "ghcr.io/callmegautam/discord-mcp:1"
      ]
    }
  }
}
```

### Or run it as a long-lived HTTP server

By default every MCP client starts its own container over stdio. With `TRANSPORT=http` one container keeps running, logs in to Discord once, and serves any number of clients over [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http), each in its own session.

Every request needs a bearer token, and the server refuses to start in HTTP mode without one. Generate a token and add it to `.env`:

```sh
echo "HTTP_TOKEN=$(openssl rand -hex 32)" >> .env
```

Start the container, published on localhost only:

```sh
docker run -d --name discord-mcp --restart unless-stopped \
  --env-file /absolute/path/to/discord-mcp/.env -e TRANSPORT=http \
  -p 127.0.0.1:3000:3000 \
  --health-cmd "wget -qO- http://127.0.0.1:3000/health || exit 1" \
  ghcr.io/callmegautam/discord-mcp:1
```

Then point Claude Code at it:

```sh
claude mcp add --transport http -s user \
  --header "Authorization: Bearer your-http-token" \
  discord http://127.0.0.1:3000/mcp
```

| Variable     | What it does                                                                           |
| ------------ | -------------------------------------------------------------------------------------- |
| `TRANSPORT`  | `stdio` (default) or `http`                                                            |
| `HTTP_TOKEN` | Bearer token clients must send, at least 32 characters. Required with `TRANSPORT=http` |
| `HTTP_HOST`  | Address to listen on. Defaults to `127.0.0.1`, and to `0.0.0.0` in the Docker image    |
| `HTTP_PORT`  | Port to listen on, defaults to `3000`                                                  |

The MCP endpoint is `/mcp`. `/health` answers without a token, for container health checks. Anyone with the token can use every tool the bot exposes, so keep the port off the public internet: publish it on `127.0.0.1` as above, or put the server behind a reverse proxy with TLS. Sessions idle for an hour are closed, and clients start a new one on their next request.

## Development

Requires Bun 1.4 or newer.

```sh
bun install
bun run dev        # run locally with watch mode, reads .env automatically
bun run check      # typecheck, lint, format check and tests
bun run docs:tools # regenerate docs/tools.md after changing a tool
```

`docs/tools.md` is generated from the tool schemas, and `bun run check` fails when it is out of date.

To try the tools by hand, use the MCP inspector:

```sh
bunx @modelcontextprotocol/inspector bun run src/index.ts
```

### Integration tests

`bun run check` only runs unit tests. The integration tests start the real server over stdio and call every write tool through an MCP client against a real Discord server: they create and delete channels, roles, messages, threads, invites, webhooks, emojis, stickers and events, rename the server and set its system channel, then put everything back.

Run them only against a throwaway server you made for this:

1. Create an empty server and invite the bot with **Administrator**, then drag its role to the top.
2. Run the tests with the server ID:

```sh
INTEGRATION_GUILD_ID=your-test-server-id bun run test:integration
```

They use the token from `.env`, lock the server to that one ID through `ALLOWED_GUILD_IDS`, and refuse to run when it has more than 10 members. Everything they create is named with an `mcpit` prefix, and anything left over from an interrupted run is deleted at the start of the next one.

### Layout

```
src/
  index.ts          entry point: config, Discord login, MCP over stdio or HTTP
  http.ts           Streamable HTTP server with bearer token auth and per-session MCP servers
  server.ts         builds the MCP server with its tools, resources and prompts
  config.ts         environment validation
  discord/          Discord client, guild resolution, permission checks, response shaping
  tools/            one file per tool group, registered in tools/index.ts, policy.ts
                    enforces annotations, READ_ONLY and DISABLED_TOOLS
  resources/        MCP resources (server snapshot)
  prompts/          MCP prompts
  lib/              logger, shared schemas, tool result helpers
scripts/            tool reference generator
docs/               generated tool reference
tests/              bun test suites, integration/ for the live server tests
```

stdout carries the MCP protocol. Log through `src/lib/logger.ts`, which writes to stderr, never with `console.log`.

## License

[MIT](LICENSE)
