import { describe, expect, test } from "bun:test";
import { resolveGuild } from "../src/discord/resolve";
import { UserError } from "../src/lib/result";

const alpha = { id: "111111111111111111", name: "Alpha" };
const beta = { id: "222222222222222222", name: "Beta" };
const guilds = (...list: (typeof alpha)[]) => new Map(list.map((guild) => [guild.id, guild]));
const open = { allowedGuildIds: [] };

describe("resolveGuild", () => {
  test("uses the explicit guild id first", () => {
    expect(resolveGuild(guilds(alpha, beta), { ...open, defaultGuildId: alpha.id }, beta.id)).toBe(beta);
  });

  test("falls back to the default guild id", () => {
    expect(resolveGuild(guilds(alpha, beta), { ...open, defaultGuildId: alpha.id }, undefined)).toBe(alpha);
  });

  test("picks the only server when no id is given", () => {
    expect(resolveGuild(guilds(alpha), open, undefined)).toBe(alpha);
  });

  test("fails when the bot is not in the requested server", () => {
    expect(() => resolveGuild(guilds(alpha), open, beta.id)).toThrow(UserError);
  });

  test("fails when the bot is in no server", () => {
    expect(() => resolveGuild(guilds(), open, undefined)).toThrow("not in any server");
  });

  test("lists the options when the choice is ambiguous", () => {
    expect(() => resolveGuild(guilds(alpha, beta), open, undefined)).toThrow(
      `Alpha (${alpha.id}), Beta (${beta.id})`,
    );
  });
});

describe("resolveGuild with ALLOWED_GUILD_IDS", () => {
  const onlyAlpha = { allowedGuildIds: [alpha.id] };

  test("refuses an explicit server that is not allowed", () => {
    expect(() => resolveGuild(guilds(alpha, beta), onlyAlpha, beta.id)).toThrow(
      `Server Beta (${beta.id}) is not in ALLOWED_GUILD_IDS.`,
    );
  });

  test("allows an explicit server on the list", () => {
    expect(resolveGuild(guilds(alpha, beta), onlyAlpha, alpha.id)).toBe(alpha);
  });

  test("applies the only-server rule after filtering", () => {
    expect(resolveGuild(guilds(alpha, beta), onlyAlpha, undefined)).toBe(alpha);
  });

  test("says so when none of the bot's servers are allowed", () => {
    expect(() => resolveGuild(guilds(beta), onlyAlpha, undefined)).toThrow(
      "not in any server listed in ALLOWED_GUILD_IDS",
    );
  });
});
