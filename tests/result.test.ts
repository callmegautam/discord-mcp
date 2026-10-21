import { describe, expect, test } from "bun:test";
import { run, UserError } from "../src/lib/result";

describe("run", () => {
  test("wraps the return value as pretty JSON text", async () => {
    expect(await run(() => ({ id: "1" }))).toEqual({
      content: [{ type: "text", text: JSON.stringify({ id: "1" }, null, 2) }],
    });
  });

  test("passes UserError messages through as tool errors", async () => {
    const result = await run(() => {
      throw new UserError("pick a server");
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "pick a server" }]);
  });

  test("reports unexpected errors without throwing", async () => {
    const result = await run(async () => {
      throw new Error("boom");
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Unexpected error: boom" }]);
  });
});
