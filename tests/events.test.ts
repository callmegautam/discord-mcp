import { describe, expect, test } from "bun:test";
import { GuildScheduledEventEntityType, GuildScheduledEventStatus } from "discord.js";
import {
  checkEventPlace,
  checkEventTimes,
  checkStatusChange,
  eventStatusLabel,
  eventTypeLabel,
} from "../src/discord/events";

const now = Date.parse("2026-10-21T12:00:00Z");
const hour = 60 * 60 * 1000;

describe("checkEventTimes", () => {
  test("accepts a future start with a later end or no end", () => {
    expect(() => checkEventTimes(now + hour, now + 2 * hour, now)).not.toThrow();
    expect(() => checkEventTimes(now + hour, null, now)).not.toThrow();
  });

  test("refuses a start in the past", () => {
    expect(() => checkEventTimes(now - hour, null, now)).toThrow("start_time has to be in the future");
  });

  test("refuses an end at or before the start", () => {
    expect(() => checkEventTimes(now + hour, now + hour, now)).toThrow("end_time has to be after start_time");
  });

  test("skips the future check when the start isn't changing", () => {
    expect(() => checkEventTimes(now - hour, now + hour)).not.toThrow();
  });
});

describe("checkEventPlace", () => {
  test("external events need a location and an end, and no channel", () => {
    const end = "2026-10-22T12:00:00Z";
    expect(() => checkEventPlace("external", { location: "Park", end })).not.toThrow();
    expect(() => checkEventPlace("external", { end })).toThrow("need a location");
    expect(() => checkEventPlace("external", { location: "Park" })).toThrow("need an end_time");
    expect(() => checkEventPlace("external", { location: "Park", end, channelId: "1" })).toThrow(
      "not a channel_id",
    );
  });

  test("voice and stage events need a channel and no location", () => {
    expect(() => checkEventPlace("voice", { channelId: "1" })).not.toThrow();
    expect(() => checkEventPlace("stage", {})).toThrow("stage events need a channel_id");
    expect(() => checkEventPlace("voice", { channelId: "1", location: "Park" })).toThrow(
      "location only works for external events",
    );
  });
});

describe("checkStatusChange", () => {
  const { Scheduled, Active, Completed, Canceled } = GuildScheduledEventStatus;

  test("allows starting, ending and canceling in order", () => {
    expect(() => checkStatusChange(Scheduled, Active)).not.toThrow();
    expect(() => checkStatusChange(Scheduled, Canceled)).not.toThrow();
    expect(() => checkStatusChange(Active, Completed)).not.toThrow();
  });

  test("refuses other changes and says what is possible", () => {
    expect(() => checkStatusChange(Scheduled, Completed)).toThrow(
      "A scheduled event can't be set to completed. It can go to active or canceled.",
    );
    expect(() => checkStatusChange(Active, Canceled)).toThrow("It can go to completed.");
    expect(() => checkStatusChange(Canceled, Active)).toThrow("A canceled event can't be set to active.");
  });
});

test("labels match the tool's names", () => {
  expect(eventTypeLabel(GuildScheduledEventEntityType.StageInstance)).toBe("stage");
  expect(eventTypeLabel(GuildScheduledEventEntityType.External)).toBe("external");
  expect(eventStatusLabel(GuildScheduledEventStatus.Active)).toBe("active");
});
