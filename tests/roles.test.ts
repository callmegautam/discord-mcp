import { describe, expect, test } from "bun:test";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { mergeRolePermissions, moveIndex, parseColor } from "../src/discord/roles";

describe("parseColor", () => {
  test("reads hex with or without the hash", () => {
    expect(parseColor("#5865f2")).toBe(0x5865f2);
    expect(parseColor("FFFFFF")).toBe(0xffffff);
  });
});

describe("mergeRolePermissions", () => {
  const current = new PermissionsBitField([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
  ]);

  test("adds and removes without touching the rest", () => {
    const merged = mergeRolePermissions(current, ["ManageMessages"], ["SendMessages"]);
    expect(merged.toArray().sort()).toEqual(["ManageMessages", "ViewChannel"]);
  });

  test("leaves the current permissions unchanged", () => {
    mergeRolePermissions(current, ["Administrator"], []);
    expect(current.has(PermissionFlagsBits.Administrator, false)).toBe(false);
  });

  test("refuses a permission in both lists", () => {
    expect(() => mergeRolePermissions(current, ["KickMembers"], ["KickMembers"])).toThrow(
      "KickMembers can't be both added and removed.",
    );
  });
});

describe("moveIndex", () => {
  // lowest first, like discord.js sorts roles
  const order = ["everyone", "a", "b", "c", "d"];
  const moved = (roleId: string, anchorId: string, place: "above" | "below") => {
    const result = order.filter((id) => id !== roleId);
    result.splice(moveIndex(order, roleId, anchorId, place), 0, roleId);
    return result;
  };

  test("moves a role up above another", () => {
    expect(moved("a", "c", "above")).toEqual(["everyone", "b", "c", "a", "d"]);
  });

  test("moves a role up below another", () => {
    expect(moved("a", "c", "below")).toEqual(["everyone", "b", "a", "c", "d"]);
  });

  test("moves a role down above another", () => {
    expect(moved("d", "a", "above")).toEqual(["everyone", "a", "d", "b", "c"]);
  });

  test("moves a role down below another", () => {
    expect(moved("d", "a", "below")).toEqual(["everyone", "d", "a", "b", "c"]);
  });

  test("can go directly above @everyone", () => {
    expect(moved("c", "everyone", "above")).toEqual(["everyone", "c", "a", "b", "d"]);
  });

  test("refuses below @everyone and moving relative to itself", () => {
    expect(() => moveIndex(order, "a", "everyone", "below")).toThrow("No role can go below @everyone.");
    expect(() => moveIndex(order, "a", "a", "above")).toThrow("relative to itself");
  });
});
