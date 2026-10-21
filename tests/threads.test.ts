import { describe, expect, test } from "bun:test";
import { checkForumTags, threadEditNeedsManage } from "../src/discord/threads";

const tags = [
  { id: "1", name: "Bug", moderated: false },
  { id: "2", name: "Announcement", moderated: true },
];
const open = { requireTag: false, canModerate: false };

describe("checkForumTags", () => {
  test("accepts known tags and no tags", () => {
    expect(() => checkForumTags(tags, ["1"], open)).not.toThrow();
    expect(() => checkForumTags(tags, [], open)).not.toThrow();
  });

  test("refuses unknown tags and lists the forum's tags", () => {
    expect(() => checkForumTags(tags, ["9"], open)).toThrow(
      "Unknown tag IDs for this forum: 9. Its tags: Bug (1), Announcement (2).",
    );
  });

  test("requires a tag when the forum does", () => {
    expect(() => checkForumTags(tags, [], { ...open, requireTag: true })).toThrow(
      "requires at least one tag",
    );
  });

  test("moderated tags need Manage Threads", () => {
    expect(() => checkForumTags(tags, ["2"], open)).toThrow("Manage Threads can apply Announcement");
    expect(() => checkForumTags(tags, ["2"], { ...open, canModerate: true })).not.toThrow();
  });
});

describe("threadEditNeedsManage", () => {
  const own = { ownedByBot: true, locked: false };

  test("the bot can rename and archive its own unlocked thread", () => {
    expect(threadEditNeedsManage({}, own)).toBe(false);
  });

  test("locking, slowmode, locked threads and other people's threads need it", () => {
    expect(threadEditNeedsManage({ locked: true }, own)).toBe(true);
    expect(threadEditNeedsManage({ slowmode_seconds: 5 }, own)).toBe(true);
    expect(threadEditNeedsManage({}, { ...own, locked: true })).toBe(true);
    expect(threadEditNeedsManage({}, { ...own, ownedByBot: false })).toBe(true);
  });
});
