import { Client, Events, GatewayIntentBits } from "discord.js";

export async function createDiscordClient(token: string): Promise<Client<true>> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  const ready = new Promise<Client<true>>((resolve) => client.once(Events.ClientReady, resolve));
  await client.login(token);
  return ready;
}
