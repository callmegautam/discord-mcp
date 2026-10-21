import { z } from "zod";

export const snowflake = z.string().regex(/^\d{17,20}$/, "must be a Discord ID (17 to 20 digits)");

export const colorArg = z
  .string()
  .regex(/^#?[0-9a-fA-F]{6}$/, "must be a hex color like #5865f2")
  .describe("Hex color like #5865f2.");

// 512 characters is Discord's limit for the X-Audit-Log-Reason header.
export const reasonArg = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .optional()
  .describe("Why this is being done. Shown in the server audit log.");

export const unloggedReasonArg = reasonArg.describe(
  "Why this is being done. Discord keeps no audit log entry for this action, so the reason only goes to this server's log.",
);

export const guildIdArg = snowflake
  .optional()
  .describe(
    "Server ID. Defaults to DISCORD_GUILD_ID, or to the only server the bot is in when it is in exactly one.",
  );
