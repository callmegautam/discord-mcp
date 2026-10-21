import { z } from "zod";
import { LOG_LEVELS, type LogLevel } from "./lib/logger";
import { snowflake } from "./lib/schemas";

export interface Config {
  token: string;
  defaultGuildId?: string;
  logLevel: LogLevel;
}

// docker --env-file passes `KEY=` as an empty string, treat that as unset.
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z.object({
  DISCORD_TOKEN: z.preprocess(
    emptyToUndefined,
    z.string({ error: "DISCORD_TOKEN is required" }).trim().min(1, "DISCORD_TOKEN is required"),
  ),
  DISCORD_GUILD_ID: z.preprocess(emptyToUndefined, snowflake.optional()),
  LOG_LEVEL: z.preprocess(emptyToUndefined, z.enum(LOG_LEVELS).default("info")),
});

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid configuration. ${issues.join("; ")}`);
  }

  return {
    token: parsed.data.DISCORD_TOKEN,
    defaultGuildId: parsed.data.DISCORD_GUILD_ID,
    logLevel: parsed.data.LOG_LEVEL,
  };
}
