import { PermissionsBitField } from "discord.js";
import { UserError } from "../lib/result";
import type { PermissionName } from "./channels";

export type Placement = "above" | "below";

/** "#5865f2" or "5865F2" to 0x5865f2. */
export function parseColor(hex: string): number {
  return Number.parseInt(hex.replace(/^#/, ""), 16);
}

/** The role's permissions with some added and some removed, everything else unchanged. */
export function mergeRolePermissions(
  current: Readonly<PermissionsBitField>,
  add: readonly PermissionName[],
  remove: readonly PermissionName[],
): PermissionsBitField {
  const both = add.filter((name) => remove.includes(name));
  if (both.length > 0) throw new UserError(`${both.join(", ")} can't be both added and removed.`);
  return new PermissionsBitField(current).add(add).remove(remove);
}

/**
 * The index to pass to discord.js setPosition so the role lands directly above or below the anchor.
 * `order` is every role ID from lowest (@everyone) to highest, which is how discord.js sorts them.
 */
export function moveIndex(
  order: readonly string[],
  roleId: string,
  anchorId: string,
  place: Placement,
): number {
  const from = order.indexOf(roleId);
  const anchor = order.indexOf(anchorId);
  if (from === -1 || anchor === -1) throw new Error("role or anchor missing from the role order");
  if (from === anchor) throw new UserError("A role can't be moved relative to itself.");
  if (place === "below" && anchor === 0) throw new UserError("No role can go below @everyone.");
  const anchorAfterRemoval = from < anchor ? anchor - 1 : anchor;
  return place === "above" ? anchorAfterRemoval + 1 : anchorAfterRemoval;
}
