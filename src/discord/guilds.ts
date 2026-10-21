import { GuildVerificationLevel } from "discord.js";
import { UserError } from "../lib/result";

export const VERIFICATION_LEVELS = {
  none: GuildVerificationLevel.None,
  low: GuildVerificationLevel.Low,
  medium: GuildVerificationLevel.Medium,
  high: GuildVerificationLevel.High,
  very_high: GuildVerificationLevel.VeryHigh,
} as const;

export type VerificationLevelName = keyof typeof VERIFICATION_LEVELS;
export const VERIFICATION_LEVEL_NAMES = Object.keys(VERIFICATION_LEVELS) as [
  VerificationLevelName,
  ...VerificationLevelName[],
];

export function requireVerificationLevelAllowed(
  level: GuildVerificationLevel,
  features: readonly string[],
): void {
  if (level === GuildVerificationLevel.None && features.includes("COMMUNITY")) {
    throw new UserError("Community servers need a verification level of at least low.");
  }
}
