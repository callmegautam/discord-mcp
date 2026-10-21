import { UserError } from "../lib/result";

// Discord's upload limits for custom emojis and stickers. Icons and avatars get a generous cap.
export const MAX_EMOJI_BYTES = 256 * 1024;
export const MAX_STICKER_BYTES = 512 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const DOWNLOAD_TIMEOUT_MS = 15_000;

export function checkFileSize(url: string, bytes: number, maxBytes: number): void {
  if (bytes > maxBytes) {
    throw new UserError(`${url} is ${Math.ceil(bytes / 1024)} KB, the limit here is ${maxBytes / 1024} KB.`);
  }
}

/**
 * Downloads a file to upload to Discord. discord.js can fetch URLs itself, but it reads any other
 * string as a local path and uploads error pages as if they were the file.
 */
export async function downloadFile(url: string, maxBytes: number): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) }).catch(
    (error: unknown) => {
      throw new UserError(
        `Couldn't download ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  );
  if (!response.ok) throw new UserError(`Downloading ${url} failed with HTTP ${response.status}.`);
  const declared = Number(response.headers.get("content-length"));
  if (declared > 0) checkFileSize(url, declared, maxBytes);
  const data = Buffer.from(await response.arrayBuffer());
  checkFileSize(url, data.length, maxBytes);
  return data;
}
