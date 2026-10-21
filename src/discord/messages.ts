import { parseEmoji, SnowflakeUtil, type APIEmbed } from "discord.js";
import { UserError } from "../lib/result";
import { parseColor } from "./roles";

// Discord's limits for message content, embeds and bulk deletes.
export const MAX_CONTENT_LENGTH = 2000;
export const MAX_EMBEDS = 10;
export const MAX_EMBED_FIELDS = 25;
export const MAX_EMBED_TOTAL = 6000;
export const MAX_BULK_DELETE = 100;
export const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface EmbedInput {
  title?: string;
  description?: string;
  url?: string;
  color?: string;
  author_name?: string;
  footer_text?: string;
  image_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
}

export function buildEmbed(input: EmbedInput): APIEmbed {
  const embed: APIEmbed = {
    title: input.title,
    description: input.description,
    url: input.url,
    color: input.color === undefined ? undefined : parseColor(input.color),
    author: input.author_name === undefined ? undefined : { name: input.author_name },
    footer: input.footer_text === undefined ? undefined : { text: input.footer_text },
    image: input.image_url === undefined ? undefined : { url: input.image_url },
    thumbnail: input.thumbnail_url === undefined ? undefined : { url: input.thumbnail_url },
    timestamp: input.timestamp,
    fields: input.fields?.map(({ name, value, inline }) => ({ name, value, inline: inline ?? false })),
  };
  const visible = [embed.title, embed.description, embed.author, embed.footer, embed.image, embed.thumbnail];
  if (visible.every((part) => part === undefined) && !embed.fields?.length) {
    throw new UserError("An embed needs at least a title, description, author, footer, image or field.");
  }
  return embed;
}

/** Discord caps the text of all embeds in one message at 6000 characters combined. */
export function embedTextLength(embeds: readonly APIEmbed[]): number {
  let total = 0;
  for (const embed of embeds) {
    total += (embed.title?.length ?? 0) + (embed.description?.length ?? 0);
    total += (embed.author?.name.length ?? 0) + (embed.footer?.text.length ?? 0);
    for (const field of embed.fields ?? []) total += field.name.length + field.value.length;
  }
  return total;
}

export function buildEmbeds(inputs: readonly EmbedInput[]): APIEmbed[] {
  const embeds = inputs.map(buildEmbed);
  const length = embedTextLength(embeds);
  if (length > MAX_EMBED_TOTAL) {
    throw new UserError(
      `The embeds have ${length} characters of text combined, Discord allows ${MAX_EMBED_TOTAL}.`,
    );
  }
  return embeds;
}

/** Splits message IDs into ones Discord can still bulk delete and ones older than 14 days. */
export function splitByBulkDeleteAge(
  ids: readonly string[],
  now: number,
): { recent: string[]; old: string[] } {
  const recent: string[] = [];
  const old: string[] = [];
  for (const id of ids) {
    (now - SnowflakeUtil.timestampFrom(id) < BULK_DELETE_MAX_AGE_MS ? recent : old).push(id);
  }
  return { recent, old };
}

/**
 * Checks an emoji argument and returns the key discord.js caches reactions under: the ID for a
 * custom emoji, the character itself for a Unicode one.
 */
export function emojiKey(text: string): string {
  const emoji = parseEmoji(text);
  if (!emoji?.name) throw new UserError(`${text} is not an emoji.`);
  if (emoji.id) return emoji.id;
  if (text.includes(":")) {
    throw new UserError(`Custom emojis need their ID, as <:name:id>. Got ${text}.`);
  }
  return emoji.name;
}
