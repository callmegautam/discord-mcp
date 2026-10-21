import { describe, expect, test } from "bun:test";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import {
  compareRoles,
  permissionName,
  requireMemberBelowBot,
  requirePermissions,
  requirePermissionsToGrant,
  requireRoleBelowBot,
} from "../src/discord/guards";

const guildId = "100000000000000000";
const ownerId = "200000000000000000";
const role = (id: string, name: string, position: number, managed = false) => ({
  id,
  name,
  position,
  managed,
});
const botTop = role("300000000000000000", "Bot", 5);

describe("requirePermissions", () => {
  const manageChannels = new PermissionsBitField(PermissionFlagsBits.ManageChannels);

  test("passes when every permission is there", () => {
    expect(() => requirePermissions(manageChannels, [PermissionFlagsBits.ManageChannels])).not.toThrow();
  });

  test("names each missing permission", () => {
    expect(() =>
      requirePermissions(
        manageChannels,
        [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.BanMembers],
        "#general",
      ),
    ).toThrow("The bot is missing the Ban Members, Manage Roles permissions in #general.");
  });

  test("treats Administrator as having everything", () => {
    const admin = new PermissionsBitField(PermissionFlagsBits.Administrator);
    expect(() => requirePermissions(admin, [PermissionFlagsBits.BanMembers])).not.toThrow();
  });

  test("splits flag names into words", () => {
    expect(permissionName("ManageGuildExpressions")).toBe("Manage Guild Expressions");
  });
});

describe("requirePermissionsToGrant", () => {
  const have = new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);

  test("passes for permissions the bot has", () => {
    expect(() => requirePermissionsToGrant(have, ["ViewChannel", "SendMessages"], "Test")).not.toThrow();
  });

  test("names the permissions the bot can't hand out", () => {
    expect(() =>
      requirePermissionsToGrant(have, ["ViewChannel", "ManageMessages"], "category Staff"),
    ).toThrow(
      "The bot can only allow or deny permissions it has itself. It lacks Manage Messages in category Staff.",
    );
  });
});

describe("compareRoles", () => {
  test("orders by position", () => {
    expect(compareRoles(role("2", "a", 3), role("1", "b", 2))).toBeGreaterThan(0);
  });

  test("ranks the older role higher on a position tie", () => {
    expect(compareRoles(role("1", "old", 2), role("2", "new", 2))).toBeGreaterThan(0);
  });
});

describe("requireRoleBelowBot", () => {
  test("passes for a lower role", () => {
    expect(() => requireRoleBelowBot(guildId, botTop, role("400000000000000000", "Member", 2))).not.toThrow();
  });

  test("explains a role at or above the bot", () => {
    expect(() => requireRoleBelowBot(guildId, botTop, role("400000000000000000", "Admin", 9))).toThrow(
      "Role Admin is at or above the bot's highest role Bot. Drag the bot's role higher",
    );
  });

  test("refuses integration roles", () => {
    expect(() =>
      requireRoleBelowBot(guildId, botTop, role("400000000000000000", "Booster", 1, true)),
    ).toThrow("managed by an integration");
  });

  test("refuses @everyone", () => {
    expect(() => requireRoleBelowBot(guildId, botTop, role(guildId, "@everyone", 0))).toThrow("@everyone");
  });
});

describe("requireMemberBelowBot", () => {
  const bot = { id: "500000000000000000", displayName: "bot", highestRole: botTop };
  const member = (id: string, position: number) => ({
    id,
    displayName: "sam",
    highestRole: role("600000000000000000", "Mod", position),
  });

  test("passes for a member below the bot", () => {
    expect(() => requireMemberBelowBot(ownerId, bot, member("700000000000000000", 2))).not.toThrow();
  });

  test("explains a member at or above the bot", () => {
    expect(() => requireMemberBelowBot(ownerId, bot, member("700000000000000000", 7))).toThrow(
      "sam's highest role Mod is at or above the bot's highest role Bot.",
    );
  });

  test("refuses the server owner", () => {
    expect(() => requireMemberBelowBot(ownerId, bot, member(ownerId, 0))).toThrow("server owner");
  });

  test("refuses the bot itself", () => {
    expect(() => requireMemberBelowBot(ownerId, bot, { ...bot })).toThrow("itself");
  });
});
