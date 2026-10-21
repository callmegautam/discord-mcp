import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";

const token = "test-token";
const guildId = "123456789012345678";

describe("loadConfig", () => {
  test("reads token, guild id and log level", () => {
    expect(loadConfig({ DISCORD_TOKEN: token, DISCORD_GUILD_ID: guildId, LOG_LEVEL: "debug" })).toEqual({
      token,
      defaultGuildId: guildId,
      logLevel: "debug",
    });
  });

  test("defaults log level to info and leaves guild id unset", () => {
    expect(loadConfig({ DISCORD_TOKEN: token })).toEqual({
      token,
      defaultGuildId: undefined,
      logLevel: "info",
    });
  });

  test("treats empty values from an env file as unset", () => {
    expect(loadConfig({ DISCORD_TOKEN: token, DISCORD_GUILD_ID: "", LOG_LEVEL: "" })).toEqual({
      token,
      defaultGuildId: undefined,
      logLevel: "info",
    });
  });

  test("trims whitespace around the token", () => {
    expect(loadConfig({ DISCORD_TOKEN: `  ${token}\n` }).token).toBe(token);
  });

  test("rejects a missing or blank token", () => {
    expect(() => loadConfig({})).toThrow("DISCORD_TOKEN is required");
    expect(() => loadConfig({ DISCORD_TOKEN: "" })).toThrow("DISCORD_TOKEN is required");
    expect(() => loadConfig({ DISCORD_TOKEN: "   " })).toThrow("DISCORD_TOKEN is required");
  });

  test("rejects a malformed guild id", () => {
    expect(() => loadConfig({ DISCORD_TOKEN: token, DISCORD_GUILD_ID: "my-server" })).toThrow(
      "DISCORD_GUILD_ID",
    );
  });

  test("rejects an unknown log level", () => {
    expect(() => loadConfig({ DISCORD_TOKEN: token, LOG_LEVEL: "loud" })).toThrow("LOG_LEVEL");
  });
});
