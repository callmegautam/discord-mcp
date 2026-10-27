import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { enabled, PREFIX, startServer, testGuildId, type TestServer } from "./harness";

interface Named {
  id: string;
  name: string;
}
interface Channel extends Named {
  type: string;
  parentId: string | null;
  topic: string | null;
  slowmodeSeconds: number | null;
}
interface Role extends Named {
  color: string;
  position: number;
  permissions: string[];
}
interface Message {
  id: string;
  content: string;
  pinned: boolean;
  author: { id: string };
  embeds: { title: string | null }[];
}
interface Thread extends Named {
  parentId: string;
  archived: boolean;
  locked: boolean;
}

const IMAGE_URL = "https://cdn.discordapp.com/embed/avatars/0.png";
const THUMBS_UP = "\u{1F44D}";
const reason = "discord-mcp integration test";

let server: TestServer;
let botId: string;
let ownerId: string;
let category: Channel;
let text: Channel;
let forum: Channel;

async function reactionCount(target: { channel_id: string; message_id: string }): Promise<number> {
  const { message } = await server.call<{ message: { reactions: { count: number }[] } }>(
    "get_message",
    target,
  );
  return message.reactions.reduce((sum, reaction) => sum + reaction.count, 0);
}

/** Deletes everything a previous, interrupted run left behind. */
async function sweep(): Promise<void> {
  const ours = (item: { name: string | null }) => item.name?.startsWith(PREFIX) ?? false;
  const deleteAll = async (items: Named[], tool: string, key: string) => {
    for (const item of items.filter(ours)) await server.call(tool, { [key]: item.id, reason });
  };
  await deleteAll(await server.call<Named[]>("list_webhooks"), "delete_webhook", "webhook_id");
  await deleteAll(await server.call<Named[]>("list_scheduled_events"), "delete_scheduled_event", "event_id");
  await deleteAll(await server.call<Named[]>("list_emojis"), "delete_emoji", "emoji_id");
  await deleteAll(await server.call<Named[]>("list_stickers"), "delete_sticker", "sticker_id");
  await deleteAll(await server.call<Named[]>("list_roles"), "delete_role", "role_id");
  const channels = await server.call<Channel[]>("list_channels");
  const sorted = channels
    .filter(ours)
    .sort((a, b) => Number(a.type === "GuildCategory") - Number(b.type === "GuildCategory"));
  await deleteAll(sorted, "delete_channel", "channel_id");
}

describe.skipIf(!enabled)("integration", () => {
  beforeAll(async () => {
    server = await startServer();
    await sweep();
    ownerId = (await server.call<{ ownerId: string }>("get_guild")).ownerId;
  });

  afterAll(async () => {
    if (!server) return;
    await sweep();
    await server.close();
  });

  describe("channels", () => {
    test("creates a category with a text, voice and forum channel in it", async () => {
      category = await server.call<Channel>("create_channel", {
        name: `${PREFIX}-category`,
        type: "category",
        reason,
      });
      expect(category.type).toBe("GuildCategory");

      text = await server.call<Channel>("create_channel", {
        name: `${PREFIX}-text`,
        parent_id: category.id,
        topic: "integration test",
        reason,
      });
      expect(text).toMatchObject({ type: "GuildText", parentId: category.id, topic: "integration test" });

      const voice = await server.call<Channel>("create_channel", {
        name: `${PREFIX}-voice`,
        type: "voice",
        parent_id: category.id,
        reason,
      });
      expect(voice.type).toBe("GuildVoice");

      forum = await server.call<Channel>("create_channel", {
        name: `${PREFIX}-forum`,
        type: "forum",
        parent_id: category.id,
        reason,
      });
      expect(forum.type).toBe("GuildForum");
    });

    test("edits a channel", async () => {
      const edited = await server.call<Channel>("edit_channel", {
        channel_id: text.id,
        topic: "edited",
        slowmode_seconds: 5,
        reason,
      });
      expect(edited).toMatchObject({ topic: "edited", slowmodeSeconds: 5 });
    });

    test("sets, lists and removes a permission overwrite", async () => {
      const everyone = testGuildId();
      await server.call("set_channel_permission", {
        channel_id: text.id,
        target_id: everyone,
        deny: ["AddReactions"],
        reason,
      });
      const { overwrites } = await server.call<{ overwrites: { id: string; deny: string[] }[] }>(
        "list_channel_permissions",
        {
          channel_id: text.id,
        },
      );
      expect(overwrites.find((o) => o.id === everyone)?.deny).toContain("AddReactions");

      await server.call("remove_channel_permission", { channel_id: text.id, target_id: everyone, reason });
      const after = await server.call<{ overwrites: { id: string }[] }>("list_channel_permissions", {
        channel_id: text.id,
      });
      expect(after.overwrites.some((o) => o.id === everyone)).toBe(false);
    });

    test("clones and deletes a channel", async () => {
      const clone = await server.call<Channel>("clone_channel", {
        channel_id: text.id,
        name: `${PREFIX}-clone`,
        reason,
      });
      expect(clone).toMatchObject({ name: `${PREFIX}-clone`, parentId: category.id, topic: "edited" });
      await server.call("delete_channel", { channel_id: clone.id, reason });
      const channels = await server.call<Channel[]>("list_channels");
      expect(channels.some((c) => c.id === clone.id)).toBe(false);
    });

    test("records the reason in the audit log", async () => {
      const { entries } = await server.call<{ entries: { targetId: string; reason: string | null }[] }>(
        "get_audit_log",
        {
          action: "ChannelCreate",
        },
      );
      expect(entries.find((e) => e.targetId === text.id)?.reason).toBe(reason);
    });
  });

  describe("messages", () => {
    let message: Message;

    test("sends, reads and edits a message with an embed", async () => {
      message = await server.call<Message>("send_message", {
        channel_id: text.id,
        content: "hello from the integration tests",
        embeds: [{ title: "Embed", description: "body", color: "#5865f2" }],
      });
      botId = message.author.id;
      expect(message.embeds[0]?.title).toBe("Embed");

      const { message: fetched } = await server.call<{ message: Message }>("get_message", {
        channel_id: text.id,
        message_id: message.id,
      });
      expect(fetched.content).toBe("hello from the integration tests");

      const edited = await server.call<Message>("edit_message", {
        channel_id: text.id,
        message_id: message.id,
        content: "edited",
      });
      expect(edited.content).toBe("edited");
    });

    test("replies to a message", async () => {
      const reply = await server.call<Message & { replyToId: string }>("send_message", {
        channel_id: text.id,
        content: "reply",
        reply_to: message.id,
      });
      expect(reply.replyToId).toBe(message.id);
    });

    test("pins and unpins", async () => {
      await server.call("pin_message", { channel_id: text.id, message_id: message.id, reason });
      const { pins: pinned } = await server.call<{ pins: { message: Message }[] }>("list_pinned_messages", {
        channel_id: text.id,
      });
      expect(pinned.some((pin) => pin.message.id === message.id)).toBe(true);
      await server.call("unpin_message", { channel_id: text.id, message_id: message.id, reason });
      const { pins: after } = await server.call<{ pins: { message: Message }[] }>("list_pinned_messages", {
        channel_id: text.id,
      });
      expect(after.some((pin) => pin.message.id === message.id)).toBe(false);
    });

    test("adds, lists, removes and clears reactions", async () => {
      const target = { channel_id: text.id, message_id: message.id };
      await server.call("add_reaction", { ...target, emoji: THUMBS_UP });
      const { users } = await server.call<{ users: { id: string }[] }>("list_reactions", {
        ...target,
        emoji: THUMBS_UP,
      });
      expect(users.map((u) => u.id)).toContain(botId);

      await server.call("remove_reaction", { ...target, emoji: THUMBS_UP });
      expect(await reactionCount(target)).toBe(0);

      await server.call("add_reaction", { ...target, emoji: THUMBS_UP });
      await server.call("clear_reactions", { ...target, reason });
      expect(await reactionCount(target)).toBe(0);
    });

    test("deletes a message and bulk deletes the rest", async () => {
      await server.call("delete_message", { channel_id: text.id, message_id: message.id, reason });
      await server.fail("get_message", { channel_id: text.id, message_id: message.id });

      const sent: string[] = [];
      for (const n of [1, 2, 3]) {
        sent.push(
          (await server.call<Message>("send_message", { channel_id: text.id, content: `bulk ${n}` })).id,
        );
      }
      const { deletedIds } = await server.call<{ deletedIds: string[] }>("bulk_delete_messages", {
        channel_id: text.id,
        count: 10,
        reason,
      });
      expect(deletedIds).toEqual(expect.arrayContaining(sent));
      const { messages } = await server.call<{ messages: Message[] }>("list_messages", {
        channel_id: text.id,
      });
      expect(messages.filter((m) => deletedIds.includes(m.id))).toEqual([]);
    });
  });

  describe("threads", () => {
    test("creates a thread, posts in it, archives and deletes it", async () => {
      const thread = await server.call<Thread>("create_thread", {
        channel_id: text.id,
        name: `${PREFIX}-thread`,
        reason,
      });
      expect(thread.parentId).toBe(text.id);

      const message = await server.call<Message>("send_message", {
        channel_id: thread.id,
        content: "in a thread",
      });
      expect(message.content).toBe("in a thread");

      const { threads: listed } = await server.call<{ threads: Thread[] }>("list_threads", {
        channel_id: text.id,
      });
      expect(listed.some((t) => t.id === thread.id)).toBe(true);

      const archived = await server.call<Thread>("edit_thread", {
        thread_id: thread.id,
        locked: true,
        archived: true,
        reason,
      });
      expect(archived).toMatchObject({ archived: true, locked: true });

      await server.call("delete_thread", { thread_id: thread.id, reason });
      await server.fail("edit_thread", { thread_id: thread.id, name: "gone" });
    });

    test("creates and deletes a forum post", async () => {
      const post = await server.call<Thread>("create_forum_post", {
        channel_id: forum.id,
        name: `${PREFIX}-post`,
        content: "first post",
        reason,
      });
      expect(post.parentId).toBe(forum.id);
      await server.call("delete_thread", { thread_id: post.id, reason });
    });
  });

  describe("roles", () => {
    let low: Role;
    let high: Role;

    test("creates and edits roles", async () => {
      low = await server.call<Role>("create_role", { name: `${PREFIX}-low`, color: "#112233", reason });
      high = await server.call<Role>("create_role", { name: `${PREFIX}-high`, reason });
      expect(low.color).toBe("#112233");

      const edited = await server.call<Role>("edit_role", {
        role_id: high.id,
        color: "#abcdef",
        add_permissions: ["ManageMessages"],
        reason,
      });
      expect(edited.color).toBe("#abcdef");
      expect(edited.permissions).toContain("ManageMessages");
    });

    test("moves a role above another", async () => {
      await server.call("move_role", { role_id: low.id, above_role_id: high.id, reason });
      const roles = await server.call<Role[]>("list_roles");
      const position = (id: string) => roles.find((r) => r.id === id)?.position ?? -1;
      expect(position(low.id)).toBeGreaterThan(position(high.id));
    });

    test("adds a role to a member and removes it", async () => {
      await server.call("add_member_role", { user_id: botId, role_id: low.id, reason });
      const { members } = await server.call<{ members: { id: string }[] }>("list_role_members", {
        role_id: low.id,
      });
      expect(members.map((m) => m.id)).toContain(botId);

      await server.call("remove_member_role", { user_id: botId, role_id: low.id, reason });
      const after = await server.call<{ members: unknown[] }>("list_role_members", { role_id: low.id });
      expect(after.members).toEqual([]);
    });

    test("deletes roles", async () => {
      await server.call("delete_role", { role_id: low.id, reason });
      await server.call("delete_role", { role_id: high.id, reason });
      const roles = await server.call<Role[]>("list_roles");
      expect(roles.some((r) => r.name.startsWith(PREFIX))).toBe(false);
    });
  });

  describe("members and moderation", () => {
    test("sets and resets the bot's nickname", async () => {
      const renamed = await server.call<{ nickname: string | null }>("set_nickname", {
        user_id: botId,
        nickname: `${PREFIX}-bot`,
        reason,
      });
      expect(renamed.nickname).toBe(`${PREFIX}-bot`);
      const reset = await server.call<{ nickname: string | null }>("set_nickname", {
        user_id: botId,
        nickname: null,
        reason,
      });
      expect(reset.nickname).toBeNull();
    });

    test("finds members by name", async () => {
      const member = await server.call<{ username: string }>("get_member", { user_id: botId });
      const found = await server.call<{ id: string }[]>("search_members", { query: member.username });
      expect(found.map((m) => m.id)).toContain(botId);
    });

    test("refuses to moderate the server owner", async () => {
      expect(await server.fail("kick_member", { user_id: ownerId, reason })).toContain("owner");
      expect(await server.fail("ban_user", { user_id: ownerId, reason })).toContain("owner");
      expect(
        await server.fail("timeout_member", { user_id: ownerId, duration_minutes: 1, reason }),
      ).toContain("owner");
    });

    test("lists bans", async () => {
      const { bans } = await server.call<{ bans: unknown[] }>("list_bans");
      expect(Array.isArray(bans)).toBe(true);
    });
  });

  describe("invites and webhooks", () => {
    test("creates, lists and deletes an invite", async () => {
      const invite = await server.call<{ code: string }>("create_invite", {
        channel_id: text.id,
        max_age_seconds: 600,
        max_uses: 1,
        unique: true,
        reason,
      });
      const invites = await server.call<{ code: string }[]>("list_invites");
      expect(invites.map((i) => i.code)).toContain(invite.code);
      await server.call("delete_invite", { code: invite.code, reason });
      const after = await server.call<{ code: string }[]>("list_invites");
      expect(after.map((i) => i.code)).not.toContain(invite.code);
    });

    test("creates a webhook, hides its URL from the list, deletes it", async () => {
      const webhook = await server.call<Named & { url: string }>("create_webhook", {
        channel_id: text.id,
        name: `${PREFIX}-hook`,
        avatar_url: IMAGE_URL,
        reason,
      });
      expect(webhook.url).toStartWith("https://");

      const listed = await server.call<(Named & { url?: string })[]>("list_webhooks");
      const entry = listed.find((w) => w.id === webhook.id);
      expect(entry).toBeDefined();
      expect(entry?.url).toBeUndefined();

      await server.call("delete_webhook", { webhook_id: webhook.id, reason });
    });
  });

  describe("emojis and stickers", () => {
    test("uploads and deletes an emoji", async () => {
      const emoji = await server.call<Named>("create_emoji", {
        name: `${PREFIX}_emoji`,
        image_url: IMAGE_URL,
        reason,
      });
      const emojis = await server.call<Named[]>("list_emojis");
      expect(emojis.some((e) => e.id === emoji.id)).toBe(true);
      await server.call("delete_emoji", { emoji_id: emoji.id, reason });
    });

    test("uploads and deletes a sticker", async () => {
      const sticker = await server.call<Named>("create_sticker", {
        name: `${PREFIX}-sticker`,
        tags: "test",
        file_url: IMAGE_URL,
        reason,
      });
      const stickers = await server.call<Named[]>("list_stickers");
      expect(stickers.some((s) => s.id === sticker.id)).toBe(true);
      await server.call("delete_sticker", { sticker_id: sticker.id, reason });
    });
  });

  describe("scheduled events", () => {
    test("creates, edits, cancels and deletes an external event", async () => {
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const event = await server.call<Named & { status: string }>("create_scheduled_event", {
        name: `${PREFIX}-event`,
        type: "external",
        location: "somewhere",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        reason,
      });
      expect(event.status).toBe("scheduled");

      const edited = await server.call<Named & { description: string }>("edit_scheduled_event", {
        event_id: event.id,
        description: "edited",
        reason,
      });
      expect(edited.description).toBe("edited");

      const canceled = await server.call<{ status: string }>("edit_scheduled_event", {
        event_id: event.id,
        status: "canceled",
        reason,
      });
      expect(canceled.status).toBe("canceled");

      await server.call("delete_scheduled_event", { event_id: event.id, reason });
    });
  });

  describe("server settings", () => {
    test("renames the server and sets the system channel, then restores both", async () => {
      const before = await server.call<{ name: string; systemChannelId: string | null }>("get_guild");
      try {
        const edited = await server.call<{ name: string; systemChannelId: string | null }>("edit_guild", {
          name: `${before.name} ${PREFIX}`,
          system_channel_id: text.id,
          reason,
        });
        expect(edited).toMatchObject({ name: `${before.name} ${PREFIX}`, systemChannelId: text.id });
      } finally {
        await server.call("edit_guild", {
          name: before.name,
          system_channel_id: before.systemChannelId,
          reason,
        });
      }
    });
  });

  describe("server insight", () => {
    interface Snapshot {
      guild: { id: string };
      roles: { id: string; everyone: boolean; memberCount: number }[];
      channels: { id: string; name: string }[];
    }
    interface Audit {
      findings: { check: string; target: string }[];
    }
    const flagged = (audit: Audit, channelId: string) =>
      audit.findings.some(
        (finding) => finding.check === "public_private_channel" && finding.target.includes(channelId),
      );

    test("lists and reads the server snapshot resource", async () => {
      const uri = `discord://guilds/${testGuildId()}/snapshot`;
      const { resources } = await server.client.listResources();
      expect(resources.map((resource) => resource.uri)).toContain(uri);

      const { contents } = await server.client.readResource({ uri });
      const content = contents[0];
      const snapshot = JSON.parse(content && "text" in content ? content.text : "{}") as Snapshot;
      expect(snapshot.guild.id).toBe(testGuildId());
      expect(snapshot.channels.map((channel) => channel.id)).toContain(text.id);
      expect(snapshot.roles.find((role) => role.everyone)?.memberCount).toBeGreaterThan(0);
    });

    test("flags a public log channel until @everyone is denied", async () => {
      const logs = await server.call<Channel>("create_channel", { name: `${PREFIX}-mod-log`, reason });
      expect(flagged(await server.call<Audit>("audit_permissions"), logs.id)).toBe(true);

      await server.call("set_channel_permission", {
        channel_id: logs.id,
        target_id: testGuildId(),
        deny: ["ViewChannel"],
        reason,
      });
      expect(flagged(await server.call<Audit>("audit_permissions"), logs.id)).toBe(false);
      await server.call("delete_channel", { channel_id: logs.id, reason });
    });

    test("serves the audit prompt", async () => {
      const { messages } = await server.client.getPrompt({ name: "audit_server_permissions", arguments: {} });
      expect(messages[0]?.content).toMatchObject({
        type: "text",
        text: expect.stringContaining("audit_permissions"),
      });
    });
  });

  describe("templates", () => {
    interface Planned {
      name: string;
      action: "create" | "skip";
      id: string | null;
    }
    interface Applied {
      dryRun: boolean;
      summary: { create: number; skip: number };
      roles: Planned[];
      categories: (Planned & { channels: Planned[] })[];
      channels: Planned[];
    }
    interface Overwrites {
      syncedWithCategory: boolean;
      overwrites: { id: string; name: string | null; allow: string[]; deny: string[] }[];
    }

    const mod = `${PREFIX}-tpl-mod`;
    const template = {
      roles: [
        { name: mod, color: "#e67e22", hoist: true, permissions: ["ManageMessages"] },
        { name: `${PREFIX}-tpl-member` },
      ],
      categories: [
        {
          name: `${PREFIX}-tpl-staff`,
          overwrites: [
            { role: "@everyone", deny: ["ViewChannel"] },
            { role: mod, allow: ["ViewChannel"] },
          ],
          channels: [
            { name: `${PREFIX}-tpl-log` },
            {
              name: `${PREFIX}-tpl-notes`,
              overwrites: [{ role: mod, allow: ["ViewChannel"], deny: ["SendMessages"] }],
            },
          ],
        },
      ],
      channels: [{ name: `${PREFIX}-tpl-welcome`, topic: "hello" }],
    };

    test("exports the server as a template that applies as a no-op", async () => {
      const { template: exported } = await server.call<{ template: unknown }>("export_template");
      const plan = await server.call<Applied>("apply_template", { template: exported, dry_run: true });
      expect(plan.summary.create).toBe(0);
      expect(plan.summary.skip).toBeGreaterThan(0);
    });

    test("dry runs without creating anything", async () => {
      const plan = await server.call<Applied>("apply_template", { template, dry_run: true, reason });
      expect(plan).toMatchObject({ dryRun: true, summary: { create: 6, skip: 0 } });
      const roles = await server.call<Role[]>("list_roles");
      expect(roles.some((role) => role.name === mod)).toBe(false);
    });

    test("applies a template, then skips everything on a rerun", async () => {
      const applied = await server.call<Applied>("apply_template", { template, reason });
      expect(applied).toMatchObject({ dryRun: false, summary: { create: 6, skip: 0 } });
      const [modRole, memberRole] = applied.roles;
      const staff = applied.categories[0]!;
      const [log, notes] = staff.channels;

      const roles = await server.call<Role[]>("list_roles");
      const position = (id: string | null | undefined) =>
        roles.find((role) => role.id === id)?.position ?? -1;
      expect(position(modRole?.id)).toBeGreaterThan(position(memberRole?.id));
      expect(roles.find((role) => role.id === modRole?.id)).toMatchObject({
        color: "#e67e22",
        permissions: ["ManageMessages"],
      });

      const staffPerms = await server.call<Overwrites>("list_channel_permissions", { channel_id: staff.id });
      expect(staffPerms.overwrites.find((o) => o.id === testGuildId())?.deny).toEqual(["ViewChannel"]);
      const logPerms = await server.call<Overwrites>("list_channel_permissions", { channel_id: log?.id });
      expect(logPerms.syncedWithCategory).toBe(true);
      const notesPerms = await server.call<Overwrites>("list_channel_permissions", { channel_id: notes?.id });
      expect(notesPerms.overwrites.find((o) => o.id === testGuildId())?.deny).toEqual(["ViewChannel"]);
      expect(notesPerms.overwrites.find((o) => o.id === modRole?.id)?.deny).toEqual(["SendMessages"]);

      const rerun = await server.call<Applied>("apply_template", { template, reason });
      expect(rerun.summary).toEqual({ create: 0, skip: 6 });

      for (const channel of [log, notes, applied.channels[0], staff]) {
        await server.call("delete_channel", { channel_id: channel?.id, reason });
      }
      for (const role of applied.roles) await server.call("delete_role", { role_id: role.id, reason });
    });

    test("refuses a template with an unknown role before changing anything", async () => {
      const error = await server.fail("apply_template", {
        template: {
          channels: [
            { name: `${PREFIX}-tpl-x`, overwrites: [{ role: `${PREFIX}-ghost`, allow: ["ViewChannel"] }] },
          ],
        },
        reason,
      });
      expect(error).toContain("nothing was changed");
    });
  });

  describe("read-only mode", () => {
    test("exposes only read tools and refuses write tools", async () => {
      const readOnly = await startServer({ READ_ONLY: "true" });
      try {
        const { tools } = await readOnly.client.listTools();
        expect(tools.length).toBeGreaterThan(0);
        expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
        expect(await readOnly.fail("create_channel", { name: `${PREFIX}-nope` })).toContain("create_channel");
      } finally {
        await readOnly.close();
      }
    });
  });
});
