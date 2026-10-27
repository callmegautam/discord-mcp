import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Collection, type Client as DiscordClient } from "discord.js";
import { loadConfig } from "../src/config";
import { createMcpServer } from "../src/server";

const guilds = new Collection([
  ["100000000000000000", { id: "100000000000000000", name: "Allowed" }],
  ["200000000000000000", { id: "200000000000000000", name: "Other" }],
]);

async function connect(env: Record<string, string> = {}) {
  const config = loadConfig({ DISCORD_TOKEN: "unused", ALLOWED_GUILD_IDS: "100000000000000000", ...env });
  const discord = { guilds: { cache: guilds } } as unknown as DiscordClient<true>;
  const { server } = createMcpServer({ client: discord, config });
  const client = new Client({ name: "server-test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("createMcpServer", () => {
  test("lists a snapshot resource for each allowed server only", async () => {
    const client = await connect();
    const { resources } = await client.listResources();
    expect(resources).toEqual([
      expect.objectContaining({
        uri: "discord://guilds/100000000000000000/snapshot",
        name: "Allowed snapshot",
        mimeType: "application/json",
      }),
    ]);
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((template) => template.uriTemplate)).toEqual([
      "discord://guilds/{guild_id}/snapshot",
    ]);
  });

  test("refuses a snapshot of a server outside ALLOWED_GUILD_IDS", async () => {
    const client = await connect();
    await expect(
      client.readResource({ uri: "discord://guilds/200000000000000000/snapshot" }),
    ).rejects.toThrow("not in ALLOWED_GUILD_IDS");
  });

  test("keeps the audit tool, resource and prompt in read-only mode", async () => {
    const client = await connect({ READ_ONLY: "true" });
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain("audit_permissions");
    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name)).toEqual(["audit_server_permissions"]);
    const { messages } = await client.getPrompt({ name: "audit_server_permissions", arguments: {} });
    expect(messages[0]?.content).toMatchObject({
      type: "text",
      text: expect.stringContaining("read-only mode"),
    });
  });

  test("points the audit prompt at the requested server", async () => {
    const client = await connect();
    const { messages } = await client.getPrompt({
      name: "audit_server_permissions",
      arguments: { guild_id: "100000000000000000" },
    });
    const text = messages[0]?.content.type === "text" ? messages[0].content.text : "";
    expect(text).toContain("pass guild_id 100000000000000000");
    expect(text).toContain("Don't change anything yet");
    expect(text).not.toContain("read-only mode");
  });

  test("offers the setup prompt only when apply_template is available", async () => {
    const names = async (env: Record<string, string> = {}) =>
      (await (await connect(env)).listPrompts()).prompts.map((prompt) => prompt.name);
    expect(await names()).toEqual(["audit_server_permissions", "setup_community_server"]);
    expect(await names({ DISABLED_TOOLS: "apply_template" })).toEqual(["audit_server_permissions"]);
  });

  test("passes the community description into the setup prompt", async () => {
    const client = await connect();
    const { messages } = await client.getPrompt({
      name: "setup_community_server",
      arguments: { description: "a chess club" },
    });
    const text = messages[0]?.content.type === "text" ? messages[0].content.text : "";
    expect(text).toContain("for this community: a chess club");
    expect(text).toContain("dry_run true");
  });
});
