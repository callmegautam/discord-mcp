import { describe, expect, test } from "bun:test";
import { DiscordAPIError } from "discord.js";
import { run, UserError } from "../src/lib/result";

describe("run", () => {
  test("wraps the return value as pretty JSON text", async () => {
    expect(await run(() => ({ id: "1" }))).toEqual({
      content: [{ type: "text", text: JSON.stringify({ id: "1" }, null, 2) }],
    });
  });

  test("passes UserError messages through as tool errors", async () => {
    const result = await run(() => {
      throw new UserError("pick a server");
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "pick a server" }]);
  });

  test("adds a hint to Missing Permissions errors", async () => {
    const result = await run(() => {
      throw new DiscordAPIError(
        { code: 50013, message: "Missing Permissions" },
        50013,
        403,
        "PUT",
        "/guilds/1/members/2/roles/3",
        {},
      );
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "Discord API error 50013 (HTTP 403): Missing Permissions. The bot lacks a permission for this, or the target is at or above the bot's highest role in Server Settings > Roles.",
      },
    ]);
  });

  test("reports unexpected errors without throwing", async () => {
    const result = await run(async () => {
      throw new Error("boom");
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Unexpected error: boom" }]);
  });
});
