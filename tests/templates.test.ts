import { describe, expect, test } from "bun:test";
import {
  MAX_TEMPLATE_CHANNELS,
  mergeOverwrites,
  nameKey,
  planNeeds,
  planTemplate,
  templateGrants,
  templateSchema,
  validateTemplate,
  type ExistingLayout,
} from "../src/discord/templates";

const parse = (input: unknown) => templateSchema.parse(input);

const empty: ExistingLayout = { roleNames: ["@everyone"], categories: [], channels: [], features: [] };

const community = parse({
  roles: [
    { name: "Moderator", color: "#e67e22", hoist: true, permissions: ["KickMembers", "ManageMessages"] },
    { name: "Member" },
  ],
  categories: [
    {
      name: "Staff",
      overwrites: [
        { role: "@everyone", deny: ["ViewChannel"] },
        { role: "Moderator", allow: ["ViewChannel"] },
      ],
      channels: [{ name: "mod-log" }, { name: "Mod Chat" }],
    },
    {
      name: "Community",
      channels: [
        { name: "general", topic: "Say hi" },
        { name: "Lounge", type: "voice" },
        { name: "rules", overwrites: [{ role: "@everyone", deny: ["SendMessages"] }] },
      ],
    },
  ],
  channels: [{ name: "welcome" }],
});

describe("templateSchema", () => {
  test("fills in defaults", () => {
    expect(parse({})).toEqual({ roles: [], categories: [], channels: [] });
    expect(parse({ channels: [{ name: "a" }] }).channels[0]).toEqual({
      name: "a",
      type: "text",
      overwrites: [],
    });
  });

  test("rejects categories as channels and unknown permissions", () => {
    expect(() => parse({ channels: [{ name: "a", type: "category" }] })).toThrow();
    expect(() => parse({ roles: [{ name: "a", permissions: ["FlyAround"] }] })).toThrow();
  });

  test("caps the number of channels", () => {
    const channels = Array.from({ length: MAX_TEMPLATE_CHANNELS + 1 }, (_, i) => ({ name: `c${i}` }));
    expect(() => parse({ channels })).toThrow(`up to ${MAX_TEMPLATE_CHANNELS}`);
  });
});

describe("validateTemplate", () => {
  test("accepts a consistent template", () => {
    expect(() => validateTemplate(community, empty)).not.toThrow();
  });

  test("accepts overwrites for roles the server already has, in any case", () => {
    const template = parse({
      channels: [{ name: "a", overwrites: [{ role: "admins", allow: ["ViewChannel"] }] }],
    });
    expect(() => validateTemplate(template, { ...empty, roleNames: ["@everyone", "Admins"] })).not.toThrow();
  });

  test("lists every problem in one error and changes nothing", () => {
    const template = parse({
      roles: [{ name: "Mod" }, { name: "mod" }],
      categories: [
        { name: "Talk", overwrites: [{ role: "Ghost", allow: ["ViewChannel"] }] },
        { name: "talk" },
      ],
      channels: [
        { name: "voice-room", type: "voice", topic: "nope" },
        { name: "news", type: "announcement" },
        { name: "a", overwrites: [{ role: "Mod", allow: ["SendMessages"], deny: ["SendMessages"] }] },
        { name: "General Chat" },
        { name: "general-chat" },
      ],
    });
    const run = () => validateTemplate(template, empty);
    expect(run).toThrow("nothing was changed");
    expect(run).toThrow("Roles listed more than once: mod.");
    expect(run).toThrow("Categories listed more than once: talk.");
    expect(run).toThrow("overwrite for Ghost, which is neither in the template nor the server");
    expect(run).toThrow("#voice-room: topic can't be set on a voice channel.");
    expect(run).toThrow("#news: announcement channels need a Community server");
    expect(run).toThrow("#a both allows and denies SendMessages for Mod.");
    expect(run).toThrow("lists general-chat more than once");
  });

  test("allows announcement channels on Community servers", () => {
    const template = parse({ channels: [{ name: "news", type: "announcement" }] });
    expect(() => validateTemplate(template, { ...empty, features: ["COMMUNITY"] })).not.toThrow();
  });
});

describe("planTemplate", () => {
  test("creates everything on an empty server", () => {
    const plan = planTemplate(community, empty);
    expect(plan.roles.map((entry) => entry.action)).toEqual(["create", "create"]);
    expect(plan.categories.map((category) => [category.action, category.existingId])).toEqual([
      ["create", null],
      ["create", null],
    ]);
    expect(planNeeds(plan)).toEqual({ roles: true, channels: true, overwrites: true });
  });

  test("skips what exists by name, matching Discord's text channel names", () => {
    const existing: ExistingLayout = {
      roleNames: ["@everyone", "moderator"],
      categories: [{ id: "500000000000000000", name: "STAFF" }],
      channels: [
        { name: "mod-chat", parentId: "500000000000000000" },
        { name: "welcome", parentId: null },
        { name: "general", parentId: "600000000000000000" },
      ],
      features: [],
    };
    const plan = planTemplate(community, existing);
    expect(plan.roles.map(({ role, action }) => [role.name, action])).toEqual([
      ["Moderator", "skip"],
      ["Member", "create"],
    ]);
    const [staff, talk] = plan.categories;
    expect(staff).toMatchObject({ action: "skip", existingId: "500000000000000000" });
    expect(staff?.channels.map((entry) => entry.action)).toEqual(["create", "skip"]);
    expect(talk?.channels.map((entry) => entry.action)).toEqual(["create", "create", "create"]);
    expect(plan.channels.map((entry) => entry.action)).toEqual(["skip"]);
  });

  test("needs nothing when everything exists", () => {
    const template = parse({ roles: [{ name: "A" }], channels: [{ name: "b" }] });
    const plan = planTemplate(template, {
      ...empty,
      roleNames: ["A"],
      channels: [{ name: "b", parentId: null }],
    });
    expect(planNeeds(plan)).toEqual({ roles: false, channels: false, overwrites: false });
  });
});

describe("templateGrants", () => {
  test("collects role permissions and overwrite allows and denies once each", () => {
    expect(new Set(templateGrants(community))).toEqual(
      new Set(["KickMembers", "ManageMessages", "ViewChannel", "SendMessages"] as const),
    );
    expect(templateGrants(community)).toHaveLength(4);
  });
});

describe("mergeOverwrites", () => {
  const category = [
    { id: "1", allow: ["ViewChannel"] },
    { id: "2", allow: ["ViewChannel"] },
  ];

  test("leaves a channel without overwrites to sync with its category", () => {
    expect(mergeOverwrites(category, [])).toEqual([]);
  });

  test("lets the channel's overwrite replace the category's for the same role", () => {
    expect(mergeOverwrites(category, [{ id: "2", allow: ["SendMessages"] }])).toEqual([
      { id: "1", allow: ["ViewChannel"] },
      { id: "2", allow: ["SendMessages"] },
    ]);
  });
});

describe("nameKey", () => {
  test("matches how Discord stores text channel names", () => {
    expect(nameKey("  General   Chat ")).toBe("general-chat");
  });
});
