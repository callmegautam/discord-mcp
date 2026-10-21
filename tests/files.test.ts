import { expect, test } from "bun:test";
import { checkFileSize, MAX_EMOJI_BYTES } from "../src/discord/files";
import { httpsUrlArg } from "../src/lib/schemas";

test("checkFileSize refuses files over the limit", () => {
  expect(() => checkFileSize("https://a.b/c.png", MAX_EMOJI_BYTES, MAX_EMOJI_BYTES)).not.toThrow();
  expect(() => checkFileSize("https://a.b/c.png", 300 * 1024, MAX_EMOJI_BYTES)).toThrow(
    "is 300 KB, the limit here is 256 KB",
  );
});

test("file URLs have to be https", () => {
  expect(httpsUrlArg.safeParse("https://example.com/a.png").success).toBe(true);
  expect(httpsUrlArg.safeParse("http://example.com/a.png").success).toBe(false);
  expect(httpsUrlArg.safeParse("file:///etc/passwd").success).toBe(false);
});
