import { expect, test } from "bun:test";
import { REFERENCE_PATH, renderToolReference } from "../scripts/tool-reference";

test("docs/tools.md matches the registered tools, run bun run docs:tools if this fails", async () => {
  expect(await Bun.file(REFERENCE_PATH).text()).toBe(await renderToolReference());
});
