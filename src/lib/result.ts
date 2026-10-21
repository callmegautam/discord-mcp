import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DiscordAPIError } from "discord.js";
import { logger } from "./logger";

/** An error whose message is safe and useful to show to the model as is. */
export class UserError extends Error {
  override name = "UserError";
}

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
      return fail(`Discord API error ${error.code} (HTTP ${error.status}): ${error.message}`);
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`unexpected tool error: ${message}`);
    return fail(`Unexpected error: ${message}`);
  }
}
