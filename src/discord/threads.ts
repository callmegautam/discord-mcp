import { UserError } from "../lib/result";

export const AUTO_ARCHIVE_MINUTES = [60, 1440, 4320, 10080] as const;
export const MAX_APPLIED_TAGS = 5;

interface ForumTag {
  id: string;
  name: string;
  moderated: boolean;
}

/** Checks tag IDs against the forum's tags, its require tag setting and moderated tags. */
export function checkForumTags(
  available: readonly ForumTag[],
  tagIds: readonly string[],
  { requireTag, canModerate }: { requireTag: boolean; canModerate: boolean },
): void {
  const unknown = tagIds.filter((id) => !available.some((tag) => tag.id === id));
  if (unknown.length > 0) {
    const options = available.map((tag) => `${tag.name} (${tag.id})`).join(", ") || "none";
    throw new UserError(`Unknown tag IDs for this forum: ${unknown.join(", ")}. Its tags: ${options}.`);
  }
  if (requireTag && tagIds.length === 0)
    throw new UserError("This forum requires at least one tag on a post.");
  const moderated = available.filter((tag) => tag.moderated && tagIds.includes(tag.id));
  if (moderated.length > 0 && !canModerate) {
    throw new UserError(
      `Only members with Manage Threads can apply ${moderated.map((tag) => tag.name).join(", ")}.`,
    );
  }
}

/**
 * The thread owner can rename, archive, reopen and retag an unlocked thread without Manage Threads.
 * Locking and slowmode always need it.
 */
export function threadEditNeedsManage(
  changes: { locked?: boolean; slowmode_seconds?: number },
  { ownedByBot, locked }: { ownedByBot: boolean; locked: boolean },
): boolean {
  if (!ownedByBot || locked) return true;
  return changes.locked !== undefined || changes.slowmode_seconds !== undefined;
}
