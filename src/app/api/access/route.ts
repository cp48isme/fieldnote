/**
 * The access route: where the caller key is exchanged for a cookie. ADR-0012.
 *
 * WHY A FORM AND NOT A FETCH. The key has to reach the server somehow, and the obvious
 * way — read it from the settings screen and add an `Authorization` header in
 * `src/lib/generation/client.ts` — would put a watched path in the diff and make the
 * adversarial eval suite call the live model to test a prompt nobody changed. It would
 * also mean the key sits somewhere a script can read it. A plain HTML form posts here
 * with no script at all, and the answer comes back as an `HttpOnly` cookie the page
 * cannot read and the browser attaches to `/api` requests on its own. The key is
 * therefore never in IndexedDB, never in `localStorage`, and never in `document.cookie`.
 *
 * WHAT BOUNDS THIS REQUEST. It is a second same-origin request the page makes, and it is
 * a form submission, so `tests/unit/single-egress.test.ts` — a grep for `fetch` and its
 * relatives — does not see it and could not. What bounds it is `form-action 'self'` in
 * the policy in `src/proxy.ts`, asserted against a live response in
 * `tests/e2e/headers.spec.ts`: the browser will not post this form anywhere but here.
 * The model egress is unchanged; nothing about any attendee crosses this route.
 *
 * WHAT IT LOGS. Status, reason, and the action. Never the key, never its hash, never the
 * cookie. The unconfigured case names the variable and nothing else, the way the
 * generation route already names `ANTHROPIC_API_KEY`.
 */

import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  ACCESS_KEY_HASHES_VARIABLE,
  configuredHashes,
  keyMatches,
} from "@/lib/access/key";

/** Never prerendered: this handler exists to be called, not built. */
export const dynamic = "force-dynamic";

const FORM_MEDIA_TYPE = "application/x-www-form-urlencoded";

/** Where the browser is sent after a decision. A 303 so the reload is a GET, not a repost. */
const AFTER_SAVE = "/";
const AFTER_FAILURE = "/settings?failed=1";

/** Metadata only. Every field here is a string, a number, or a boolean. */
function log(entry: Record<string, string | number | boolean | null>): void {
  console.info(JSON.stringify({ route: "access", ...entry }));
}

/**
 * The cookie, written by hand rather than through a helper so that every attribute this
 * decision depends on is visible in one string and asserted in one test.
 *
 * `HttpOnly` keeps it out of `document.cookie`. `Secure` keeps it off plain HTTP; on
 * `localhost` browsers treat the origin as secure, which is what lets the end-to-end test
 * exercise the real thing. `SameSite=Strict` means a request originating from any other
 * site does not carry it, so a page elsewhere cannot make the representative's browser
 * spend her model budget. `Path=/api` means it is attached to the two routes under `/api`
 * and to nothing else — not to the document, not to the worker, not to an image.
 */
function setCookie(value: string, maxAgeSeconds: number): string {
  return [
    `${ACCESS_COOKIE}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/api",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

/**
 * A relative `Location`, which RFC 7231 allows and every browser resolves against the
 * request. Deliberately not an absolute URL built from `request.url`: behind the proxy
 * that resolved to `localhost` while the request had arrived at `127.0.0.1`, and a
 * redirect that changes the host is a redirect to an origin the cookie does not belong
 * to. The end-to-end suite found it.
 */
function redirect(to: string, cookie?: string): NextResponse {
  const headers = new Headers({ Location: to });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new NextResponse(null, { status: 303, headers });
}

export async function POST(request: Request): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.split(";")[0]!.trim().toLowerCase().startsWith(FORM_MEDIA_TYPE)) {
    log({ status: 415, reason: "content-type" });
    return NextResponse.json(
      { error: `Body must be ${FORM_MEDIA_TYPE}.` },
      { status: 415 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    log({ status: 400, reason: "not-a-form" });
    return NextResponse.json(
      { error: "Body could not be read as a form." },
      { status: 400 },
    );
  }

  const action = String(form.get("action") ?? "save");

  // Forgetting needs no key and no configuration: expiring a cookie cannot be an attack.
  if (action === "forget") {
    log({ status: 303, action, reason: "forgotten" });
    return redirect(AFTER_SAVE, setCookie("", 0));
  }

  const hashes = configuredHashes(process.env[ACCESS_KEY_HASHES_VARIABLE]);
  if (hashes.length === 0) {
    // Unconfigured is refused, never open. The variable is named; nothing else is.
    log({
      status: 503,
      action,
      reason: "hashes-undefined",
      variable: ACCESS_KEY_HASHES_VARIABLE,
    });
    return NextResponse.json(
      { error: `${ACCESS_KEY_HASHES_VARIABLE} is not defined.` },
      { status: 503 },
    );
  }

  const submitted = form.get("key");
  const key = typeof submitted === "string" ? submitted.trim() : "";
  if (!(await keyMatches(key, hashes))) {
    log({ status: 303, action, reason: "no-match", configured: hashes.length });
    return redirect(AFTER_FAILURE);
  }

  log({
    status: 303,
    action,
    reason: "accepted",
    configured: hashes.length,
    maxAgeSeconds: ACCESS_COOKIE_MAX_AGE_SECONDS,
  });
  return redirect(AFTER_SAVE, setCookie(key, ACCESS_COOKIE_MAX_AGE_SECONDS));
}
