import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PermissionFlagsBits, type GuildBasedChannel } from "discord.js";
import { z } from "zod";
import { MAX_IMAGE_BYTES, downloadFile } from "../discord/files";
import { botMember, requirePermissions } from "../discord/guards";
import { serializeWebhook } from "../discord/serialize";
import { run, UserError } from "../lib/result";
import { guildIdArg, httpsUrlArg, reasonArg, snowflake } from "../lib/schemas";
import { getChannel, getGuild, getWebhook, type ToolContext } from "./context";

const nameArg = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((name) => !/clyde|discord/i.test(name), "Discord doesn't allow clyde or discord in webhook names")
  .describe("Webhook name, 1 to 80 characters, without clyde or discord in it.");

function requireManageWebhooks(channel: GuildBasedChannel): void {
  requirePermissions(
    botMember(channel.guild).permissionsIn(channel),
    [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageWebhooks],
    `#${channel.name}`,
  );
}

export function registerWebhookTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_webhooks",
    {
      title: "List webhooks",
      description:
        "List the server's webhooks, or one channel's. Webhook URLs contain a secret token and are not returned.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: snowflake.optional().describe("Only list webhooks in this channel."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, channel_id }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        if (channel_id) {
          const channel = await getChannel(guild, channel_id);
          requireManageWebhooks(channel);
          return [...(await guild.channels.fetchWebhooks(channel)).values()].map(serializeWebhook);
        }
        requirePermissions(botMember(guild).permissions, [PermissionFlagsBits.ManageWebhooks]);
        return [...(await guild.fetchWebhooks()).values()].map(serializeWebhook);
      }),
  );

  server.registerTool(
    "create_webhook",
    {
      title: "Create webhook",
      description:
        "Create a webhook in a channel. Returns its URL, which contains a secret token: anyone with it can post to the channel, so only hand it to the service that needs it.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: snowflake.describe("Channel the webhook posts to."),
        name: nameArg,
        avatar_url: httpsUrlArg.optional().describe("https URL of an image to use as the webhook's avatar."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, channel_id, name, avatar_url, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const channel = await getChannel(guild, channel_id);
        if (!("createWebhook" in channel))
          throw new UserError(`${channel.name} is a category and can't have webhooks.`);
        requireManageWebhooks(channel);
        const avatar = avatar_url ? await downloadFile(avatar_url, MAX_IMAGE_BYTES) : undefined;
        const webhook = await channel.createWebhook({ name, avatar, reason });
        return { ...serializeWebhook(webhook), url: webhook.url };
      }),
  );

  server.registerTool(
    "delete_webhook",
    {
      title: "Delete webhook",
      description: "Delete a webhook. Anything still posting through its URL stops working.",
      inputSchema: {
        guild_id: guildIdArg,
        webhook_id: snowflake.describe("The webhook ID."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, webhook_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const webhook = await getWebhook(ctx.client, guild, webhook_id);
        const channel = await getChannel(guild, webhook.channelId);
        requireManageWebhooks(channel);
        const deleted = serializeWebhook(webhook);
        await webhook.delete(reason);
        return { deleted };
      }),
  );
}
