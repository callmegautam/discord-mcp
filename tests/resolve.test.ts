import { describe, expect, test } from "bun:test";
import { resolveGuild } from "../src/discord/resolve";
import { UserError } from "../src/lib/result";

const alpha = { id: "111111111111111111", name: "Alpha" };
const beta = { id: "222222222222222222", name: "Beta" };
const guilds = (...list: (typeof alpha)[]) => new Map(list.map((guild) => [guild.id, guild]));

describe("resolveGuild", () => {
  test("uses the explicit guild id first", () => {
    expect(resolveGuild(guilds(alpha, beta), alpha.id, beta.id)).toBe(beta);
  });

  test("falls back to the default guild id", () => {
    expect(resolveGuild(guilds(alpha, beta), alpha.id, undefined)).toBe(alpha);
  });

  test("picks the only server when no id is given", () => {
    expect(resolveGuild(guilds(alpha), undefined, undefined)).toBe(alpha);
  });

  test("fails when the bot is not in the requested server", () => {
    expect(() => resolveGuild(guilds(alpha), undefined, beta.id)).toThrow(UserError);
  });

  test("fails when the bot is in no server", () => {
    expect(() => resolveGuild(guilds(), undefined, undefined)).toThrow("not in any server");
  });

  test("lists the options when the choice is ambiguous", () => {
    expect(() => resolveGuild(guilds(alpha, beta), undefined, undefined)).toThrow(
      `Alpha (${alpha.id}), Beta (${beta.id})`,
    );
  });
});
