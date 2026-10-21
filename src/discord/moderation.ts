import { AuditLogEvent } from "discord.js";

type AuditLogAction = keyof typeof AuditLogEvent;

export const AUDIT_LOG_ACTIONS = Object.keys(AuditLogEvent).filter((key) => Number.isNaN(Number(key))) as [
  AuditLogAction,
  ...AuditLogAction[],
];

// Discord's limits: a timeout lasts at most 28 days, a ban deletes at most 7 days of messages.
export const MAX_TIMEOUT_MINUTES = 28 * 24 * 60;
export const MAX_BAN_DELETE_HOURS = 7 * 24;

function plainRef(value: object) {
  const { id, name, displayName } = value as Record<string, unknown>;
  const label = typeof name === "string" ? name : typeof displayName === "string" ? displayName : undefined;
  return { id: id ?? null, ...(label === undefined ? {} : { name: label }) };
}

// The extra field can hold live discord.js structures (a channel, role or member), which are
// circular, so they are reduced to an id and name.
export function plainAuditExtra(extra: unknown): unknown {
  if (extra === null || extra === undefined) return null;
  if (typeof extra !== "object") return extra;
  if ("id" in extra) return plainRef(extra);
  return Object.fromEntries(
    Object.entries(extra).map(([key, value]) => [
      key,
      value !== null && typeof value === "object" ? plainRef(value) : value,
    ]),
  );
}
