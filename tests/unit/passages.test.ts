/** Loading passages into the library: refused with the rule named, or stored. */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listApprovedContent, removeApprovedContent } from "@/lib/db";
import { setDatabase } from "@/lib/db/database";
import { loadPassage, PassageRefusedError, replacePassage } from "@/lib/library/passages";

import { FakeDatabase } from "./support/fake-database";

let db: FakeDatabase;
beforeEach(() => {
  db = new FakeDatabase();
  setDatabase(db.asDatabase());
});
afterEach(() => setDatabase(null));

const CLEAN = {
  label: "Control panel",
  body: "The open control console sits at eye level and is designed to move between rooms on its own stand.",
  sourceRef: "SYN-DOC-0001 v1",
};

describe("loadPassage", () => {
  it("stores a passage that trips no loading rule", async () => {
    const stored = await loadPassage(CLEAN);
    expect(stored.body).toBe(CLEAN.body);
    expect(await listApprovedContent()).toHaveLength(1);
  });

  it("refuses a passage that mentions a meal, and stores nothing", async () => {
    await expect(
      loadPassage({ ...CLEAN, body: "Join us for lunch after the demonstration." }),
    ).rejects.toMatchObject({ name: "PassageRefusedError", rule: "hospitality" });
    expect(await listApprovedContent()).toHaveLength(0);
  });

  it("refuses a passage that names a person after a title", async () => {
    const error: unknown = await loadPassage({
      ...CLEAN,
      body: "Dr. Marlow mentioned the same concern last month.",
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PassageRefusedError);
    expect((error as PassageRefusedError).rule).toBe("invented-name");
  });

  it("checks a replacement the same way, and removal keeps nothing of the body", async () => {
    const stored = await loadPassage(CLEAN);
    await expect(
      replacePassage(stored.id, { ...CLEAN, body: "Available at a 15% reduction." }),
    ).rejects.toMatchObject({ rule: "pricing" });
    const replaced = await replacePassage(stored.id, { ...CLEAN, label: "Panel" });
    expect(replaced.label).toBe("Panel");
    await removeApprovedContent(stored.id);
    expect(await listApprovedContent()).toEqual([]);
  });
});
