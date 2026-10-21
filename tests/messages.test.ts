import { describe, expect, test } from "bun:test";
import { SnowflakeUtil } from "discord.js";
import {
  BULK_DELETE_MAX_AGE_MS,
  buildEmbed,
  buildEmbeds,
  embedTextLength,
  emojiKey,
  splitByBulkDeleteAge,
} from "../src/discord/messages";

describe("buildEmbed", () => {
  test("maps tool fields to a Discord embed", () => {
    expect(
      buildEmbed({
        title: "Rules",
        color: "#5865f2",
        author_name: "Mods",
        footer_text: "Read them",
        image_url: "https://example.com/a.png",
        fields: [{ name: "1", value: "Be nice" }],
      }),
    ).toEqual({
      title: "Rules",
      description: undefined,
      url: undefined,
      color: 0x5865f2,
      author: { name: "Mods" },
      footer: { text: "Read them" },
      image: { url: "https://example.com/a.png" },
      thumbnail: undefined,
      timestamp: undefined,
      fields: [{ name: "1", value: "Be nice", inline: false }],
    });
  });

  test("refuses an embed with nothing to show", () => {
    expect(() => buildEmbed({ color: "#ffffff", url: "https://example.com" })).toThrow("at least a title");
    expect(() => buildEmbed({ fields: [] })).toThrow("at least a title");
  });
});

describe("embed text limit", () => {
  test("counts titles, descriptions, authors, footers and fields", () => {
    expect(
      embedTextLength([
        { title: "ab", description: "cde", author: { name: "f" }, footer: { text: "gh" } },
        { fields: [{ name: "ij", value: "k" }] },
      ]),
    ).toBe(11);
  });

  test("refuses embeds over 6000 characters combined", () => {
    const big = { description: "x".repeat(4000) };
    expect(() => buildEmbeds([big])).not.toThrow();
    expect(() => buildEmbeds([big, big])).toThrow("8000 characters");
  });
});

describe("splitByBulkDeleteAge", () => {
  const now = Date.now();
  const idAt = (timestamp: number) => SnowflakeUtil.generate({ timestamp }).toString();

  test("keeps messages younger than 14 days and splits off older ones", () => {
    const fresh = idAt(now - 1000);
    const almost = idAt(now - BULK_DELETE_MAX_AGE_MS + 60_000);
    const old = idAt(now - BULK_DELETE_MAX_AGE_MS - 60_000);
    expect(splitByBulkDeleteAge([fresh, old, almost], now)).toEqual({ recent: [fresh, almost], old: [old] });
  });
});

describe("emojiKey", () => {
  test("uses the character for Unicode emojis", () => {
    expect(emojiKey("\u{1F44D}")).toBe("\u{1F44D}");
  });

  test("uses the ID for custom emojis", () => {
    expect(emojiKey("<:party:123456789012345678>")).toBe("123456789012345678");
    expect(emojiKey("<a:dance:123456789012345678>")).toBe("123456789012345678");
    expect(emojiKey("party:123456789012345678")).toBe("123456789012345678");
  });

  test("refuses a custom emoji without its ID", () => {
    expect(() => emojiKey(":party:")).toThrow("Custom emojis need their ID");
  });
});
