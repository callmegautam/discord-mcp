import { GuildScheduledEventEntityType, GuildScheduledEventStatus } from "discord.js";
import { UserError } from "../lib/result";

export const EVENT_TYPES = {
  voice: GuildScheduledEventEntityType.Voice,
  stage: GuildScheduledEventEntityType.StageInstance,
  external: GuildScheduledEventEntityType.External,
} as const;

export type EventTypeName = keyof typeof EVENT_TYPES;
export const EVENT_TYPE_NAMES = Object.keys(EVENT_TYPES) as [EventTypeName, ...EventTypeName[]];

export const EVENT_STATUSES = {
  active: GuildScheduledEventStatus.Active,
  completed: GuildScheduledEventStatus.Completed,
  canceled: GuildScheduledEventStatus.Canceled,
} as const;

export type EventStatusName = keyof typeof EVENT_STATUSES;
export const EVENT_STATUS_NAMES = Object.keys(EVENT_STATUSES) as [EventStatusName, ...EventStatusName[]];

export function eventTypeLabel(type: GuildScheduledEventEntityType): string {
  return EVENT_TYPE_NAMES.find((name) => EVENT_TYPES[name] === type) ?? GuildScheduledEventEntityType[type];
}

export function eventStatusLabel(status: GuildScheduledEventStatus): string {
  return GuildScheduledEventStatus[status].toLowerCase();
}

/** `now` is left out when the start time isn't changing, an event that already started can keep it. */
export function checkEventTimes(start: number, end: number | null, now?: number): void {
  if (now !== undefined && start <= now) throw new UserError("start_time has to be in the future.");
  if (end !== null && end <= start) throw new UserError("end_time has to be after start_time.");
}

/** Voice and stage events happen in a channel, external ones at a location and need an end time. */
export function checkEventPlace(
  type: EventTypeName,
  { channelId, location, end }: { channelId?: string; location?: string; end?: string },
): void {
  if (type === "external") {
    if (channelId) throw new UserError("External events take a location, not a channel_id.");
    if (!location) throw new UserError("External events need a location.");
    if (!end) throw new UserError("External events need an end_time.");
    return;
  }
  if (!channelId) throw new UserError(`${type} events need a channel_id.`);
  if (location) throw new UserError("location only works for external events.");
}

const NEXT_STATUS: Record<GuildScheduledEventStatus, readonly GuildScheduledEventStatus[]> = {
  [GuildScheduledEventStatus.Scheduled]: [
    GuildScheduledEventStatus.Active,
    GuildScheduledEventStatus.Canceled,
  ],
  [GuildScheduledEventStatus.Active]: [GuildScheduledEventStatus.Completed],
  [GuildScheduledEventStatus.Completed]: [],
  [GuildScheduledEventStatus.Canceled]: [],
};

export function checkStatusChange(from: GuildScheduledEventStatus, to: GuildScheduledEventStatus): void {
  if (NEXT_STATUS[from].includes(to)) return;
  const allowed = NEXT_STATUS[from].map(eventStatusLabel);
  throw new UserError(
    `A ${eventStatusLabel(from)} event can't be set to ${eventStatusLabel(to)}.${allowed.length > 0 ? ` It can go to ${allowed.join(" or ")}.` : ""}`,
  );
}
