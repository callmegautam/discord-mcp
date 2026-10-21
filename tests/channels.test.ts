import { describe, expect, test } from "bun:test";
import { ChannelType, OverwriteType, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import {
  buildOverwrite,
  CHANNEL_TYPES,
  channelTypeLabel,
  checkChannelFields,
  PERMISSION_NAMES,
  requireChannelTypeAvailable,
} from "../src/discord/channels";
import { serializeOverwrite } from "../src/discord/serialize";

describe("channel types", () => {
  test("maps tool names to Discord types", () => {
    expect(CHANNEL_TYPES.announcement).toBe(ChannelType.GuildAnnouncement);
    expect(CHANNEL_TYPES.stage).toBe(ChannelType.GuildStageVoice);
  });

  test("labels known types by tool name and others by discord.js name", () => {
    expect(channelTypeLabel(ChannelType.GuildVoice)).toBe("voice");
    expect(channelTypeLabel(ChannelType.GuildMedia)).toBe("GuildMedia");
  });

  test("announcement and stage channels need a Community server", () => {
    expect(() => requireChannelTypeAvailable(ChannelType.GuildStageVoice, [])).toThrow(
      "stage channels need a Community server",
    );
    expect(() => requireChannelTypeAvailable(ChannelType.GuildAnnouncement, ["COMMUNITY"])).not.toThrow();
    expect(() => requireChannelTypeAvailable(ChannelType.GuildForum, [])).not.toThrow();
  });
});

describe("checkChannelFields", () => {
  test("allows fields the type has", () => {
    expect(() =>
      checkChannelFields(ChannelType.GuildText, {
        topic: "hi",
        slowmode_seconds: 5,
        nsfw: true,
        parent_id: "1",
      }),
    ).not.toThrow();
  });

  test("ignores fields that are not passed", () => {
    expect(() =>
      checkChannelFields(ChannelType.GuildCategory, { topic: undefined, name: "x" }),
    ).not.toThrow();
  });

  test("rejects a topic on a voice channel", () => {
    expect(() => checkChannelFields(ChannelType.GuildVoice, { topic: "hi" })).toThrow(
      "topic can't be set on a voice channel.",
    );
  });

  test("treats null as a change", () => {
    expect(() => checkChannelFields(ChannelType.GuildVoice, { topic: null })).toThrow("topic");
  });

  test("rejects slowmode on announcement channels and a parent on categories", () => {
    expect(() => checkChannelFields(ChannelType.GuildAnnouncement, { slowmode_seconds: 10 })).toThrow(
      "slowmode_seconds",
    );
    expect(() => checkChannelFields(ChannelType.GuildCategory, { parent_id: null })).toThrow("parent_id");
  });
});

describe("buildOverwrite", () => {
  test("maps allow, deny and inherit to true, false and null", () => {
    expect(buildOverwrite(["ViewChannel"], ["SendMessages"], ["AddReactions"])).toEqual({
      ViewChannel: true,
      SendMessages: false,
      AddReactions: null,
    });
  });

  test("rejects a permission listed twice", () => {
    expect(() => buildOverwrite(["ViewChannel"], ["ViewChannel"], [])).toThrow(
      "ViewChannel is listed more than once.",
    );
  });

  test("needs at least one permission", () => {
    expect(() => buildOverwrite([], [], [])).toThrow("at least one permission");
  });

  test("permission names match discord.js flags", () => {
    expect(PERMISSION_NAMES).toContain("ManageChannels");
    expect(PERMISSION_NAMES).toHaveLength(Object.keys(PermissionFlagsBits).length);
  });
});

describe("serializeOverwrite", () => {
  test("lists allowed and denied permissions by name", () => {
    const overwrite = {
      id: "100000000000000000",
      type: OverwriteType.Role,
      allow: new PermissionsBitField(PermissionFlagsBits.ViewChannel),
      deny: new PermissionsBitField(PermissionFlagsBits.SendMessages),
    };
    expect(serializeOverwrite(overwrite, "@everyone")).toEqual({
      id: "100000000000000000",
      type: "role",
      name: "@everyone",
      allow: ["ViewChannel"],
      deny: ["SendMessages"],
    });
  });

  test("marks member overwrites", () => {
    const empty = new PermissionsBitField();
    const overwrite = { id: "2", type: OverwriteType.Member, allow: empty, deny: empty };
    expect(serializeOverwrite(overwrite, null).type).toBe("member");
  });
});
