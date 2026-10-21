import { describe, expect, test } from "bun:test";
import { Collection, type Guild, type GuildTextBasedChannel } from "discord.js";
import { getMessage, loadAllMembers } from "../src/tools/context";

function fakeGuild(fetch: () => Promise<unknown>) {
  return { members: { fetch } } as unknown as Guild;
}

describe("loadAllMembers", () => {
  test("fetches the member list once per server", async () => {
    let calls = 0;
    const guild = fakeGuild(async () => calls++);
    await Promise.all([loadAllMembers(guild), loadAllMembers(guild)]);
    await loadAllMembers(guild);
    expect(calls).toBe(1);
  });

  test("tries again after a failed fetch", async () => {
    let calls = 0;
    const guild = fakeGuild(async () => {
      calls++;
      if (calls === 1) throw new Error("rate limited");
    });
    await expect(loadAllMembers(guild)).rejects.toThrow("rate limited");
    await loadAllMembers(guild);
    expect(calls).toBe(2);
  });
});

describe("getMessage", () => {
  test("drops the cached copy before fetching so removed reactions don't linger", async () => {
    const cache = new Collection([["123", { reactions: "stale" }]]);
    let cachedDuringFetch = true;
    const channel = {
      name: "general",
      messages: {
        cache,
        fetch: async () => {
          cachedDuringFetch = cache.has("123");
          return { id: "123" };
        },
      },
    } as unknown as GuildTextBasedChannel;
    expect(await getMessage(channel, "123")).toEqual({ id: "123" } as never);
    expect(cachedDuringFetch).toBe(false);
  });
});
