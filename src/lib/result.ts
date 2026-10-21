import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DiscordAPIError } from "discord.js";
import { logger } from "./logger";

/** An error whose message is safe and useful to show to the model as is. */
export class UserError extends Error {
  override name = "UserError";
}

const ERROR_HINTS: Record<number, string> = {
  10014: "Discord doesn't know this emoji. Custom emojis have to come from a server the bot is in.",
  30003: "The channel has hit Discord's limit of pinned messages, unpin one first.",
  50001: "The bot can't see this channel or resource, check its role and the channel permission overwrites.",
  50013:
    "The bot lacks a permission for this, or the target is at or above the bot's highest role in Server Settings > Roles.",
  50006: "A message needs content, an embed or an attachment, it can't end up empty.",
  50074:
    "Community servers need their rules and updates channels, pick other ones in Server Settings > Community first.",
};

export function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export async function run(handler: () => unknown): Promise<CallToolResult> {
  try {
    return ok(await handler());
  } catch (error) {
    if (error instanceof UserError) return fail(error.message);
    if (error instanceof DiscordAPIError) {
      const hint = ERROR_HINTS[Number(error.code)];
      return fail(
        `Discord API error ${error.code} (HTTP ${error.status}): ${error.message}${hint ? `. ${hint}` : ""}`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`unexpected tool error: ${message}`);
    return fail(`Unexpected error: ${message}`);
  }
}
