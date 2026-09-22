/**
 * The access route: the form post that exchanges a key for the cookie. ADR-0012.
 *
 * Every attribute of the cookie is asserted, because each one is load-bearing and none of
 * them is visible anywhere else: `HttpOnly` is what keeps the key out of `document.cookie`,
 * `Secure` keeps it off plain HTTP, `SameSite=Strict` stops another site's page spending
 * the model budget, and `Path=/api` keeps it off every request for the document itself.
 */

import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { ACCESS_COOKIE_MAX_AGE_SECONDS, hashKey } from "@/lib/access/key";

const { POST } = await import("@/app/api/access/route");

const KEY = "fieldnote-route-not-a-real-key";
const OTHER_KEY = "fieldnote-route-second-device";

function form(
  fields: Record<string, string>,
  contentType = "application/x-www-form-urlencoded",
): Request {
  return new Request("http://localhost/api/access", {
    method: "POST",
    headers: { "content-type": contentType },
    body: new URLSearchParams(fields).toString(),
  });
}

/** Every logged line, parsed, so a test can search all of them for a forbidden value. */
function logged(info: MockInstance<typeof console.info>): string {
  return info.mock.calls.map((call) => String(call[0])).join("\n");
}

describe("the access route", () => {
  let info: MockInstance<typeof console.info>;

  beforeEach(async () => {
    vi.stubEnv("FIELDNOTE_ACCESS_KEY_HASHES", await hashKey(KEY));
    info = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("refuses a body that is not a form, before reading it", async () => {
    const response = await POST(form({ action: "save", key: KEY }, "application/json"));
    expect(response.status).toBe(415);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets the cookie on the right key, with every attribute", async () => {
    const response = await POST(form({ action: "save", key: KEY }));

    expect(response.status).toBe(303);
    // Back to the settings screen with a flag, not to the app in silence: a saved key
    // used to look exactly like having done nothing (`fieldnote-cno`).
    expect(response.headers.get("location")).toBe("/settings?saved=1");

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`fieldnote_access=${encodeURIComponent(KEY)}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api");
    expect(cookie).toContain(`Max-Age=${ACCESS_COOKIE_MAX_AGE_SECONDS}`);
  });

  it("accepts any of several configured devices", async () => {
    vi.stubEnv(
      "FIELDNOTE_ACCESS_KEY_HASHES",
      `${await hashKey(KEY)},${await hashKey(OTHER_KEY)}`,
    );
    const response = await POST(form({ action: "save", key: OTHER_KEY }));
    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("fieldnote_access=");
  });

  it("sets nothing on a wrong key and says so in the redirect", async () => {
    const response = await POST(form({ action: "save", key: "wrong" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/settings?failed=1");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets nothing when no key is submitted", async () => {
    const response = await POST(form({ action: "save" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("failed=1");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refuses with the variable unset, naming it and nothing else", async () => {
    vi.stubEnv("FIELDNOTE_ACCESS_KEY_HASHES", "");
    const response = await POST(form({ action: "save", key: KEY }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("FIELDNOTE_ACCESS_KEY_HASHES");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(logged(info)).toContain("hashes-undefined");
  });

  it("forgets the device by expiring the cookie, and needs no key to do it", async () => {
    vi.stubEnv("FIELDNOTE_ACCESS_KEY_HASHES", "");
    const response = await POST(form({ action: "forget" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/settings?forgotten=1");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("fieldnote_access=;");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Path=/api");
  });

  it("logs metadata only: no key, no hash, no cookie", async () => {
    const hash = await hashKey(KEY);
    await POST(form({ action: "save", key: KEY }));
    await POST(form({ action: "save", key: "wrong" }));
    await POST(form({ action: "forget" }));

    const lines = logged(info);
    expect(lines).not.toContain(KEY);
    expect(lines).not.toContain(hash);
    expect(lines).not.toContain("wrong");
    expect(lines).not.toContain("Set-Cookie");
    // And it does say what happened, so the line is worth writing.
    expect(lines).toContain("accepted");
    expect(lines).toContain("no-match");
    expect(lines).toContain("forgotten");
  });
});
