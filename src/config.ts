import { z } from "zod";
import { LOG_LEVELS, type LogLevel } from "./lib/logger";
import { snowflake } from "./lib/schemas";

export interface Config {
  token: string;
  defaultGuildId?: string;
  /** Empty means every server the bot is in is allowed. */
  allowedGuildIds: string[];
  readOnly: boolean;
  /** Requests the privileged Message Content intent, needed to read what other users wrote. */
  messageContent: boolean;
  disabledTools: string[];
  logLevel: LogLevel;
}

// docker --env-file passes `KEY=` as an empty string, treat that as unset.
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const commaList = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : value,
    z.array(item).default([]),
  );

const envSchema = z
  .object({
    DISCORD_TOKEN: z.preprocess(
      emptyToUndefined,
      z.string({ error: "DISCORD_TOKEN is required" }).trim().min(1, "DISCORD_TOKEN is required"),
    ),
    DISCORD_GUILD_ID: z.preprocess(emptyToUndefined, snowflake.optional()),
    ALLOWED_GUILD_IDS: commaList(snowflake),
    READ_ONLY: z.preprocess(
      emptyToUndefined,
      z.stringbool({ error: "must be true or false" }).default(false),
    ),
    MESSAGE_CONTENT: z.preprocess(
      emptyToUndefined,
      z.stringbool({ error: "must be true or false" }).default(false),
    ),
    DISABLED_TOOLS: commaList(z.string().regex(/^[a-z_]+$/, "must be snake_case tool names")),
    LOG_LEVEL: z.preprocess(emptyToUndefined, z.enum(LOG_LEVELS).default("info")),
  })
  .refine(
    (env) =>
      !env.DISCORD_GUILD_ID ||
      env.ALLOWED_GUILD_IDS.length === 0 ||
      env.ALLOWED_GUILD_IDS.includes(env.DISCORD_GUILD_ID),
    { path: ["DISCORD_GUILD_ID"], message: "must be one of ALLOWED_GUILD_IDS" },
  );

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid configuration. ${issues.join("; ")}`);
  }

  return {
    token: parsed.data.DISCORD_TOKEN,
    defaultGuildId: parsed.data.DISCORD_GUILD_ID,
    allowedGuildIds: parsed.data.ALLOWED_GUILD_IDS,
    readOnly: parsed.data.READ_ONLY,
    messageContent: parsed.data.MESSAGE_CONTENT,
    disabledTools: parsed.data.DISABLED_TOOLS,
    logLevel: parsed.data.LOG_LEVEL,
  };
}
