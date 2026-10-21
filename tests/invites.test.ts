import { describe, expect, test } from "bun:test";
import { parseInviteCode } from "../src/discord/invites";

describe("parseInviteCode", () => {
  test("takes bare codes and invite links", () => {
    expect(parseInviteCode("abc-123")).toBe("abc-123");
    expect(parseInviteCode("https://discord.gg/abc123")).toBe("abc123");
    expect(parseInviteCode("discord.com/invite/abc123/")).toBe("abc123");
    expect(parseInviteCode("https://discordapp.com/invite/abc123")).toBe("abc123");
  });

  test("refuses anything else", () => {
    expect(() => parseInviteCode("https://example.com/abc123")).toThrow("not an invite code");
  });
});
