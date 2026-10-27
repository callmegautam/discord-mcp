import { describe, expect, test } from "bun:test";
import { loadConfig, type Config } from "../src/config";

const token = "test-token";
const guildId = "123456789012345678";
const otherGuildId = "876543210987654321";
const httpToken = "a".repeat(32);

const defaults: Config = {
  token,
  defaultGuildId: undefined,
  allowedGuildIds: [],
  readOnly: false,
  messageContent: false,
  disabledTools: [],
  logLevel: "info",
  transport: "stdio",
  http: { host: "127.0.0.1", port: 3000, token: undefined },
};

describe("loadConfig", () => {
  test("reads every setting", () => {
    expect(
      loadConfig({
        DISCORD_TOKEN: token,
        DISCORD_GUILD_ID: guildId,
        ALLOWED_GUILD_IDS: `${guildId},${otherGuildId}`,
        READ_ONLY: "true",
        MESSAGE_CONTENT: "true",
        DISABLED_TOOLS: "list_members,get_member",
        LOG_LEVEL: "debug",
        TRANSPORT: "http",
        HTTP_HOST: "0.0.0.0",
        HTTP_PORT: "8080",
        HTTP_TOKEN: httpToken,
      }),
    ).toEqual({
      token,
      defaultGuildId: guildId,
      allowedGuildIds: [guildId, otherGuildId],
      readOnly: true,
      messageContent: true,
      disabledTools: ["list_members", "get_member"],
      logLevel: "debug",
      transport: "http",
      http: { host: "0.0.0.0", port: 8080, token: httpToken },
    });
  });

  test("uses defaults when only the token is set", () => {
    expect(loadConfig({ DISCORD_TOKEN: token })).toEqual(defaults);
  });

  test("treats empty values from an env file as unset", () => {
    expect(
      loadConfig({
        DISCORD_TOKEN: token,
        DISCORD_GUILD_ID: "",
        ALLOWED_GUILD_IDS: "",
        READ_ONLY: "",
        MESSAGE_CONTENT: "",
        DISABLED_TOOLS: "",
        LOG_LEVEL: "",
        TRANSPORT: "",
        HTTP_HOST: "",
        HTTP_PORT: "",
        HTTP_TOKEN: "",
      }),
    ).toEqual(defaults);
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

  test("tolerates spaces and stray commas in lists", () => {
    const config = loadConfig({
      DISCORD_TOKEN: token,
      ALLOWED_GUILD_IDS: ` ${guildId} , ,${otherGuildId},`,
      DISABLED_TOOLS: " list_members ,",
    });
    expect(config.allowedGuildIds).toEqual([guildId, otherGuildId]);
    expect(config.disabledTools).toEqual(["list_members"]);
  });

  test("rejects a malformed id in ALLOWED_GUILD_IDS", () => {
    expect(() => loadConfig({ DISCORD_TOKEN: token, ALLOWED_GUILD_IDS: `${guildId},abc` })).toThrow(
      "ALLOWED_GUILD_IDS",
    );
  });

  test("rejects a default guild that is not on the allowlist", () => {
    expect(() =>
      loadConfig({ DISCORD_TOKEN: token, DISCORD_GUILD_ID: guildId, ALLOWED_GUILD_IDS: otherGuildId }),
    ).toThrow("DISCORD_GUILD_ID: must be one of ALLOWED_GUILD_IDS");
  });

  test("parses READ_ONLY as a boolean", () => {
    expect(loadConfig({ DISCORD_TOKEN: token, READ_ONLY: "false" }).readOnly).toBe(false);
    expect(loadConfig({ DISCORD_TOKEN: token, READ_ONLY: "1" }).readOnly).toBe(true);
    expect(() => loadConfig({ DISCORD_TOKEN: token, READ_ONLY: "maybe" })).toThrow("READ_ONLY");
  });

  test("parses MESSAGE_CONTENT as a boolean", () => {
    expect(loadConfig({ DISCORD_TOKEN: token, MESSAGE_CONTENT: "true" }).messageContent).toBe(true);
    expect(() => loadConfig({ DISCORD_TOKEN: token, MESSAGE_CONTENT: "yes please" })).toThrow(
      "MESSAGE_CONTENT",
    );
  });

  test("rejects tool names that are not snake_case", () => {
    expect(() => loadConfig({ DISCORD_TOKEN: token, DISABLED_TOOLS: "List-Members" })).toThrow(
      "DISABLED_TOOLS",
    );
  });

  test("requires a long enough HTTP_TOKEN for the http transport", () => {
    expect(() => loadConfig({ DISCORD_TOKEN: token, TRANSPORT: "http" })).toThrow(
      "HTTP_TOKEN: is required when TRANSPORT=http",
    );
    expect(() => loadConfig({ DISCORD_TOKEN: token, TRANSPORT: "http", HTTP_TOKEN: "short" })).toThrow(
      "HTTP_TOKEN: must be at least 32 characters",
    );
    expect(loadConfig({ DISCORD_TOKEN: token, TRANSPORT: "http", HTTP_TOKEN: httpToken }).http.token).toBe(
      httpToken,
    );
  });

  test("rejects an unknown transport and a bad port", () => {
    expect(() => loadConfig({ DISCORD_TOKEN: token, TRANSPORT: "carrier-pigeon" })).toThrow("TRANSPORT");
    expect(() => loadConfig({ DISCORD_TOKEN: token, HTTP_PORT: "70000" })).toThrow(
      "HTTP_PORT: must be 1 to 65535",
    );
    expect(() => loadConfig({ DISCORD_TOKEN: token, HTTP_PORT: "web" })).toThrow("HTTP_PORT");
  });
});
