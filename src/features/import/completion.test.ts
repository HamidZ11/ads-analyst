import { describe, expect, it } from "vitest";
import { openImportedClient } from "./completion";

describe("import completion", () => {
  it("selects the imported client, then opens the Overview at /overview", async () => {
    const calls: string[] = [];
    await openImportedClient(
      "client-123",
      async (id) => {
        calls.push(`select:${id}`);
      },
      (href) => calls.push(`navigate:${href}`),
    );
    expect(calls).toEqual(["select:client-123", "navigate:/overview"]);
  });
});
