import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ChannelType,
  GuildScheduledEventPrivacyLevel,
  PermissionFlagsBits,
  Routes,
  type Guild,
  type GuildScheduledEvent,
} from "discord.js";
import { z } from "zod";
import {
  checkEventPlace,
  checkEventTimes,
  checkStatusChange,
  EVENT_STATUS_NAMES,
  EVENT_STATUSES,
  EVENT_TYPE_NAMES,
  EVENT_TYPES,
} from "../discord/events";
import { botMember, requireManageOrOwn, requirePermissions } from "../discord/guards";
import { serializeScheduledEvent } from "../discord/serialize";
import { run, UserError } from "../lib/result";
import { guildIdArg, reasonArg, snowflake } from "../lib/schemas";
import { getChannel, getGuild, getScheduledEvent, type ToolContext } from "./context";

const eventIdArg = snowflake.describe("The scheduled event ID.");
const nameArg = z.string().trim().min(1).max(100).describe("Event name, 1 to 100 characters.");
const descriptionArg = z.string().max(1000).describe("Event description, up to 1000 characters.");
const timeArg = z.iso.datetime({ offset: true });
const locationArg = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe("Where an external event happens, up to 100 characters.");

const CHANNEL_PERMISSIONS = {
  voice: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
  stage: [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.MoveMembers,
  ],
} as const;

function eventPermissions(guild: Guild, event: GuildScheduledEvent) {
  const me = botMember(guild);
  return event.channel ? me.permissionsIn(event.channel) : me.permissions;
}

export function registerEventTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_scheduled_events",
    {
      title: "List scheduled events",
      description:
        "List the server's scheduled events that haven't ended, soonest first, with how many people are interested.",
      inputSchema: { guild_id: guildIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id }) =>
      run(async () => {
        const events = await getGuild(ctx, guild_id).scheduledEvents.fetch({
          withUserCount: true,
          cache: false,
        });
        return [...events.values()]
          .sort((a, b) => (a.scheduledStartTimestamp ?? 0) - (b.scheduledStartTimestamp ?? 0))
          .map(serializeScheduledEvent);
      }),
  );

  server.registerTool(
    "create_scheduled_event",
    {
      title: "Create scheduled event",
      description:
        "Schedule an event in a voice or stage channel, or somewhere outside Discord. External events need a location and an end_time. Members see it in the server's event list and can mark themselves interested.",
      inputSchema: {
        guild_id: guildIdArg,
        name: nameArg,
        type: z.enum(EVENT_TYPE_NAMES).describe("voice or stage for a channel, external for anywhere else."),
        start_time: timeArg.describe(
          "When it starts, ISO 8601 with a time zone offset. Has to be in the future.",
        ),
        end_time: timeArg.optional().describe("When it ends, ISO 8601. Required for external events."),
        channel_id: snowflake.optional().describe("Voice or stage channel, for voice and stage events."),
        location: locationArg.optional(),
        description: descriptionArg.optional(),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, name, type, start_time, end_time, channel_id, location, description, reason }) =>
      run(async () => {
        checkEventPlace(type, { channelId: channel_id, location, end: end_time });
        checkEventTimes(Date.parse(start_time), end_time ? Date.parse(end_time) : null, Date.now());
        const guild = getGuild(ctx, guild_id);
        const me = botMember(guild);
        let channel;
        if (type === "external") {
          requirePermissions(me.permissions, [PermissionFlagsBits.CreateEvents]);
        } else {
          channel = await getChannel(guild, channel_id!);
          const wanted = type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildStageVoice;
          if (channel.type !== wanted) throw new UserError(`${channel.name} is not a ${type} channel.`);
          requirePermissions(
            me.permissionsIn(channel),
            [PermissionFlagsBits.CreateEvents, ...CHANNEL_PERMISSIONS[type]],
            channel.name,
          );
        }
        const event = await guild.scheduledEvents.create({
          name,
          description,
          scheduledStartTime: start_time,
          scheduledEndTime: end_time,
          privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          entityType: EVENT_TYPES[type],
          channel: channel?.id,
          entityMetadata: location ? { location } : undefined,
          reason,
        });
        return serializeScheduledEvent(event);
      }),
  );

  server.registerTool(
    "edit_scheduled_event",
    {
      title: "Edit scheduled event",
      description:
        "Change an event's name, description, times or location, or start, end or cancel it. A scheduled event can go to active or canceled, an active one to completed. Only the fields passed are changed.",
      inputSchema: {
        guild_id: guildIdArg,
        event_id: eventIdArg,
        name: nameArg.optional(),
        description: descriptionArg.optional(),
        start_time: timeArg.optional().describe("New start, ISO 8601. Only before the event has started."),
        end_time: timeArg.optional().describe("New end, ISO 8601."),
        location: locationArg.optional().describe("New location, external events only."),
        status: z
          .enum(EVENT_STATUS_NAMES)
          .optional()
          .describe("active starts it, completed ends it, canceled calls it off."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, event_id, name, description, start_time, end_time, location, status, reason }) =>
      run(async () => {
        const changes = { name, description, start_time, end_time, location, status };
        if (Object.values(changes).every((value) => value === undefined)) {
          throw new UserError("Pass at least one field to change.");
        }
        const guild = getGuild(ctx, guild_id);
        const event = await getScheduledEvent(guild, event_id);
        if (event.isCompleted() || event.isCanceled()) {
          throw new UserError(`${event.name} is already over and can't be changed.`);
        }
        requireManageOrOwn(
          eventPermissions(guild, event),
          PermissionFlagsBits.ManageEvents,
          PermissionFlagsBits.CreateEvents,
          event.creatorId === ctx.client.user.id,
        );
        if (location !== undefined && event.entityType !== EVENT_TYPES.external) {
          throw new UserError("location only works for external events.");
        }
        if (status) checkStatusChange(event.status, EVENT_STATUSES[status]);
        if (start_time && !event.isScheduled()) {
          throw new UserError("start_time can only change before the event has started.");
        }
        if (start_time || end_time) {
          checkEventTimes(
            start_time ? Date.parse(start_time) : event.scheduledStartTimestamp!,
            end_time ? Date.parse(end_time) : event.scheduledEndTimestamp,
            start_time ? Date.now() : undefined,
          );
        }
        const edited = await guild.scheduledEvents.edit(event, {
          name,
          description,
          scheduledStartTime: start_time,
          scheduledEndTime: end_time,
          entityMetadata: location ? { location } : undefined,
          status: status && EVENT_STATUSES[status],
          reason,
        });
        return serializeScheduledEvent(edited);
      }),
  );

  server.registerTool(
    "delete_scheduled_event",
    {
      title: "Delete scheduled event",
      description:
        "Delete a scheduled event outright. To call off an upcoming event and keep a record of it, use edit_scheduled_event with status canceled.",
      inputSchema: { guild_id: guildIdArg, event_id: eventIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, event_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const event = await getScheduledEvent(guild, event_id);
        requireManageOrOwn(
          eventPermissions(guild, event),
          PermissionFlagsBits.ManageEvents,
          PermissionFlagsBits.CreateEvents,
          event.creatorId === ctx.client.user.id,
        );
        const deleted = serializeScheduledEvent(event);
        // GuildScheduledEvent.delete() takes no audit log reason, the REST route does.
        await ctx.client.rest.delete(Routes.guildScheduledEvent(guild.id, event.id), { reason });
        return { deleted };
      }),
  );
}
