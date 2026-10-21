import { expect, test } from "bun:test";
import { GuildVerificationLevel } from "discord.js";
import { requireVerificationLevelAllowed } from "../src/discord/guilds";

test("Community servers can't drop verification to none", () => {
  expect(() => requireVerificationLevelAllowed(GuildVerificationLevel.None, ["COMMUNITY"])).toThrow(
    "at least low",
  );
  expect(() => requireVerificationLevelAllowed(GuildVerificationLevel.None, [])).not.toThrow();
  expect(() => requireVerificationLevelAllowed(GuildVerificationLevel.Low, ["COMMUNITY"])).not.toThrow();
});
