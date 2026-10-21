import { Client, Events, GatewayIntentBits } from "discord.js";

export async function createDiscordClient(
  token: string,
  { messageContent }: { messageContent: boolean },
): Promise<Client<true>> {
  // Message Content is privileged, so login fails unless it is enabled in the developer portal.
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers];
  if (messageContent) intents.push(GatewayIntentBits.MessageContent);
  const client = new Client({ intents });

  const ready = new Promise<Client<true>>((resolve) => client.once(Events.ClientReady, resolve));
  await client.login(token).catch((error: unknown) => {
    if (error instanceof Error && /disallowed intents/i.test(error.message)) {
      throw new Error(
        "Discord refused a privileged intent. Enable Server Members Intent, and Message Content Intent when MESSAGE_CONTENT=true, under Bot > Privileged Gateway Intents in the developer portal.",
      );
    }
    throw error;
  });
  return ready;
}
