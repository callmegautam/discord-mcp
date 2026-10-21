import { describe, expect, test } from "bun:test";
import { AuditLogEvent } from "discord.js";
import { AUDIT_LOG_ACTIONS, plainAuditExtra } from "../src/discord/moderation";

describe("AUDIT_LOG_ACTIONS", () => {
  test("lists every action by name and nothing else", () => {
    expect(AUDIT_LOG_ACTIONS).toContain("MemberBanAdd");
    expect(AUDIT_LOG_ACTIONS.every((name) => typeof AuditLogEvent[name] === "number")).toBe(true);
    expect(AUDIT_LOG_ACTIONS.some((name) => /^\d+$/.test(name))).toBe(false);
  });
});

describe("plainAuditExtra", () => {
  test("returns null when there is no extra", () => {
    expect(plainAuditExtra(null)).toBeNull();
    expect(plainAuditExtra(undefined)).toBeNull();
  });

  test("reduces a structure to its id and name", () => {
    const role = { id: "1", name: "Mod", guild: { circular: true } };
    expect(plainAuditExtra(role)).toEqual({ id: "1", name: "Mod" });
  });

  test("uses displayName for members", () => {
    expect(plainAuditExtra({ id: "2", displayName: "sam", user: {} })).toEqual({ id: "2", name: "sam" });
  });

  test("keeps plain values and reduces nested structures", () => {
    const channel = { id: "3", name: "general", messages: {} };
    expect(plainAuditExtra({ channel, count: 4 })).toEqual({
      channel: { id: "3", name: "general" },
      count: 4,
    });
    expect(plainAuditExtra({ removed: 5, days: 7 })).toEqual({ removed: 5, days: 7 });
  });
});
