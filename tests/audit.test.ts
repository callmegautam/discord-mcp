import { describe, expect, test } from "bun:test";
import { auditPermissions, everyoneCanView, looksPrivate } from "../src/discord/audit";
import type { GuildSnapshot } from "../src/discord/snapshot";

type Role = GuildSnapshot["roles"][number];
type Channel = GuildSnapshot["channels"][number];
type Permission = Role["permissions"][number];

const guildId = "100000000000000000";
const botRoleId = "300000000000000000";

function role(overrides: Partial<Role> & Pick<Role, "id" | "name">): Role {
  return {
    color: "#000000",
    position: 1,
    hoist: false,
    mentionable: false,
    managed: false,
    permissions: [],
    everyone: false,
    memberCount: 1,
    ...overrides,
  };
}

const everyone = (permissions: Permission[] = ["ViewChannel", "SendMessages"]) =>
  role({ id: guildId, name: "@everyone", position: 0, everyone: true, memberCount: 50, permissions });

const botRole = role({
  id: botRoleId,
  name: "MCP Bot",
  position: 5,
  managed: true,
  permissions: ["ManageRoles"],
});

const overwrite = (allow: Permission[], deny: Permission[]) => ({
  id: guildId,
  type: "role",
  name: "@everyone",
  allow,
  deny,
});

function channel(name: string, overwrites: Channel["overwrites"] = []): Channel {
  return { id: "400000000000000000", name, type: "GuildText", parentId: null, position: 0, overwrites };
}

function snapshot(
  roles: Role[],
  channels: Channel[] = [],
  guild: Partial<GuildSnapshot["guild"]> = {},
): GuildSnapshot {
  return {
    guild: {
      id: guildId,
      name: "Test",
      ownerId: "200000000000000000",
      memberCount: 50,
      verificationLevel: "Low",
      explicitContentFilter: "AllMembers",
      mfaLevel: "Elevated",
      features: [],
      ...guild,
    },
    bot: { id: "500000000000000000", highestRoleId: botRoleId, roleIds: [botRoleId] },
    roles,
    channels,
  };
}

const checks = (result: ReturnType<typeof auditPermissions>) =>
  result.findings.map((finding) => finding.check);

describe("auditPermissions", () => {
  test("finds nothing on a clean server", () => {
    const result = auditPermissions(snapshot([everyone(), botRole], [channel("general")]));
    expect(result.findings).toEqual([]);
    expect(result.summary).toEqual({ high: 0, medium: 0, low: 0 });
  });

  test("flags Administrator on @everyone as high", () => {
    const [finding] = auditPermissions(snapshot([everyone(["Administrator"]), botRole])).findings;
    expect(finding).toMatchObject({ severity: "high", check: "everyone_dangerous_permissions" });
    expect(finding?.detail).toContain("Administrator");
  });

  test("names each dangerous @everyone permission", () => {
    const [finding] = auditPermissions(
      snapshot([everyone(["ViewChannel", "BanMembers", "KickMembers"]), botRole]),
    ).findings;
    expect(finding?.detail).toBe("@everyone has Ban Members, Kick Members, so every member can use them.");
  });

  test("rates Mention Everyone on @everyone lower than moderation powers", () => {
    const result = auditPermissions(
      snapshot([everyone(["ViewChannel", "BanMembers", "MentionEveryone"]), botRole]),
    );
    expect(result.findings.map(({ check, severity }) => ({ check, severity }))).toEqual([
      { check: "everyone_dangerous_permissions", severity: "high" },
      { check: "everyone_mention", severity: "medium" },
    ]);
    expect(result.findings[0]?.detail).not.toContain("Mention");
  });

  test("flags a channel overwrite that gives @everyone moderation permissions", () => {
    const everyoneOverwrite = overwrite(["ManageMessages"], []);
    const result = auditPermissions(snapshot([everyone(), botRole], [channel("memes", [everyoneOverwrite])]));
    expect(result.findings).toEqual([
      expect.objectContaining({ check: "everyone_channel_overwrite", severity: "medium" }),
    ]);
  });

  test("rates Administrator roles by how many members hold them", () => {
    const admins = (memberCount: number, mentionable = false) =>
      role({
        id: "600000000000000000",
        name: "Admins",
        position: 3,
        permissions: ["Administrator"],
        memberCount,
        mentionable,
      });
    const severityFor = (memberCount: number) =>
      auditPermissions(snapshot([everyone(), botRole, admins(memberCount)])).findings[0]?.severity;
    expect(severityFor(2)).toBe("low");
    expect(severityFor(5)).toBe("medium");
    expect(severityFor(11)).toBe("high");
    const [finding] = auditPermissions(snapshot([everyone(), botRole, admins(1, true)])).findings;
    expect(finding?.detail).toContain("mentionable");
  });

  test("flags bots with Administrator and recognizes its own role", () => {
    const ownAdmin: Role = { ...botRole, permissions: ["Administrator"] };
    const otherBot = role({
      id: "700000000000000000",
      name: "Music",
      managed: true,
      permissions: ["Administrator"],
    });
    const findings = auditPermissions(snapshot([everyone(), ownAdmin, otherBot])).findings;
    expect(findings.map((finding) => finding.check)).toEqual(["bot_administrator", "bot_administrator"]);
    expect(findings[0]?.detail).toStartWith("This bot's role MCP Bot");
    expect(findings[1]?.detail).toStartWith("A bot or integration role Music");
  });

  test("flags staff and log channels @everyone can see", () => {
    const hidden = overwrite([], ["ViewChannel"]);
    const result = auditPermissions(
      snapshot([everyone(), botRole], [channel("mod-log"), channel("staff-chat", [hidden]), channel("blog")]),
    );
    expect(result.findings).toEqual([
      expect.objectContaining({ check: "public_private_channel", target: "#mod-log (400000000000000000)" }),
    ]);
  });

  test("flags weak server settings", () => {
    const result = auditPermissions(
      snapshot([everyone(), botRole], [], {
        verificationLevel: "None",
        explicitContentFilter: "Disabled",
        mfaLevel: "None",
      }),
    );
    expect(checks(result)).toEqual(["verification_level", "moderation_2fa", "explicit_content_filter"]);
    expect(result.summary).toEqual({ high: 0, medium: 2, low: 1 });
  });

  test("notes powerful roles above the bot", () => {
    const owner = role({
      id: "800000000000000000",
      name: "Owner",
      position: 9,
      permissions: ["ManageGuild"],
    });
    const cosmetic = role({ id: "900000000000000000", name: "Fancy", position: 8 });
    const result = auditPermissions(snapshot([everyone(), botRole, owner, cosmetic]));
    expect(result.findings).toEqual([expect.objectContaining({ check: "role_above_bot", severity: "low" })]);
  });

  test("sorts findings from most to least severe", () => {
    const result = auditPermissions(
      snapshot([everyone(["ViewChannel", "KickMembers"]), botRole], [channel("admin")], {
        explicitContentFilter: "Disabled",
      }),
    );
    expect(result.findings.map((finding) => finding.severity)).toEqual(["high", "medium", "low"]);
  });
});

describe("looksPrivate", () => {
  test("matches whole words only", () => {
    expect(looksPrivate("mod-log")).toBe(true);
    expect(looksPrivate("Staff Chat")).toBe(true);
    expect(looksPrivate("audit_log")).toBe(true);
    expect(looksPrivate("blog")).toBe(false);
    expect(looksPrivate("modern-art")).toBe(false);
  });
});

describe("everyoneCanView", () => {
  test("follows the server permission without an overwrite", () => {
    expect(everyoneCanView(everyone(), channel("a"))).toBe(true);
    expect(everyoneCanView(everyone([]), channel("a"))).toBe(false);
  });

  test("lets the channel overwrite win", () => {
    expect(everyoneCanView(everyone(), channel("a", [overwrite([], ["ViewChannel"])]))).toBe(false);
    expect(everyoneCanView(everyone([]), channel("a", [overwrite(["ViewChannel"], [])]))).toBe(true);
  });

  test("treats Administrator as seeing everything", () => {
    expect(everyoneCanView(everyone(["Administrator"]), channel("a", [overwrite([], ["ViewChannel"])]))).toBe(
      true,
    );
  });
});
