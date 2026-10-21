import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PermissionFlagsBits } from "discord.js";
import { z } from "zod";
import { MAX_EMOJI_BYTES, MAX_STICKER_BYTES, downloadFile } from "../discord/files";
import { botMember, requireManageOrOwn, requirePermissions } from "../discord/guards";
import { serializeEmoji, serializeSticker } from "../discord/serialize";
import { run } from "../lib/result";
import { guildIdArg, httpsUrlArg, reasonArg, snowflake } from "../lib/schemas";
import { getEmoji, getGuild, getRole, getSticker, type ToolContext } from "./context";

export function registerEmojiTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_emojis",
    {
      title: "List emojis",
      description:
        "List the server's custom emojis. Use the returned mention, like <:name:id>, in messages and reactions.",
      inputSchema: { guild_id: guildIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id }) =>
      run(async () => [...(await getGuild(ctx, guild_id).emojis.fetch()).values()].map(serializeEmoji)),
  );

  server.registerTool(
    "create_emoji",
    {
      title: "Create emoji",
      description:
        "Upload a custom emoji from an image URL: PNG, JPEG, GIF or WebP, up to 256 KB. Animated GIFs become animated emojis.",
      inputSchema: {
        guild_id: guildIdArg,
        name: z
          .string()
          .regex(/^\w{2,32}$/, "must be 2 to 32 letters, digits or underscores")
          .describe("Emoji name, 2 to 32 letters, digits or underscores."),
        image_url: httpsUrlArg.describe("https URL of the image."),
        role_ids: z
          .array(snowflake)
          .max(250)
          .optional()
          .describe("Only members with one of these roles can use the emoji. Leave out for everyone."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, name, image_url, role_ids, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        requirePermissions(botMember(guild).permissions, [PermissionFlagsBits.CreateGuildExpressions]);
        const roles = await Promise.all((role_ids ?? []).map((id) => getRole(guild, id)));
        const attachment = await downloadFile(image_url, MAX_EMOJI_BYTES);
        return serializeEmoji(await guild.emojis.create({ attachment, name, roles, reason }));
      }),
  );

  server.registerTool(
    "delete_emoji",
    {
      title: "Delete emoji",
      description:
        "Delete a custom emoji. Needs Manage Expressions, or Create Expressions for emojis the bot uploaded.",
      inputSchema: { guild_id: guildIdArg, emoji_id: snowflake.describe("The emoji ID."), reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, emoji_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const emoji = await getEmoji(guild, emoji_id);
        requireManageOrOwn(
          botMember(guild).permissions,
          PermissionFlagsBits.ManageGuildExpressions,
          PermissionFlagsBits.CreateGuildExpressions,
          emoji.author?.id === ctx.client.user.id,
        );
        const deleted = serializeEmoji(emoji);
        await guild.emojis.delete(emoji, reason);
        return { deleted };
      }),
  );

  server.registerTool(
    "list_stickers",
    {
      title: "List stickers",
      description: "List the server's custom stickers.",
      inputSchema: { guild_id: guildIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id }) =>
      run(async () => [...(await getGuild(ctx, guild_id).stickers.fetch()).values()].map(serializeSticker)),
  );

  server.registerTool(
    "create_sticker",
    {
      title: "Create sticker",
      description:
        "Upload a custom sticker from a file URL: PNG, APNG or GIF at 320x320, or Lottie JSON, up to 512 KB.",
      inputSchema: {
        guild_id: guildIdArg,
        name: z.string().trim().min(2).max(30).describe("Sticker name, 2 to 30 characters."),
        tags: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe("A related Unicode emoji, or words, that Discord uses to suggest the sticker."),
        description: z
          .string()
          .trim()
          .min(2)
          .max(100)
          .optional()
          .describe("Description, 2 to 100 characters."),
        file_url: httpsUrlArg.describe("https URL of the sticker file."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, name, tags, description, file_url, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        requirePermissions(botMember(guild).permissions, [PermissionFlagsBits.CreateGuildExpressions]);
        const data = await downloadFile(file_url, MAX_STICKER_BYTES);
        const fileName = new URL(file_url).pathname.split("/").pop() || "sticker.png";
        const sticker = await guild.stickers.create({
          file: { attachment: data, name: fileName },
          name,
          tags,
          description,
          reason,
        });
        return serializeSticker(sticker);
      }),
  );

  server.registerTool(
    "delete_sticker",
    {
      title: "Delete sticker",
      description:
        "Delete a custom sticker. Needs Manage Expressions, or Create Expressions for stickers the bot uploaded.",
      inputSchema: {
        guild_id: guildIdArg,
        sticker_id: snowflake.describe("The sticker ID."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, sticker_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const sticker = await getSticker(guild, sticker_id);
        requireManageOrOwn(
          botMember(guild).permissions,
          PermissionFlagsBits.ManageGuildExpressions,
          PermissionFlagsBits.CreateGuildExpressions,
          sticker.user?.id === ctx.client.user.id,
        );
        const deleted = serializeSticker(sticker);
        await guild.stickers.delete(sticker, reason);
        return { deleted };
      }),
  );
}
