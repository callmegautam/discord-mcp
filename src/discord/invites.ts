import { UserError } from "../lib/result";

const INVITE_URL =
  /^(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite|discord\.gg)\/([\w-]{2,255})\/?$/i;
const INVITE_CODE = /^[\w-]{2,255}$/;

/** Accepts a bare invite code or an invite link and returns the code. */
export function parseInviteCode(text: string): string {
  const trimmed = text.trim();
  if (INVITE_CODE.test(trimmed)) return trimmed;
  const match = INVITE_URL.exec(trimmed);
  if (!match?.[1]) throw new UserError(`${text} is not an invite code or discord.gg link.`);
  return match[1];
}
