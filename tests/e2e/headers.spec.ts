import { expect, test, type APIResponse } from "@playwright/test";

/**
 * Security headers, asserted against a live response. Plan §5 non-negotiable 4.
 *
 * The build guide is explicit: assert these against a real response rather than leaving a
 * config file nobody reads again. Every assertion here is on what the server actually
 * sent for a real request — the document, the route, the worker, the manifest — and the
 * last test is the one that catches a policy that is present but wrong: the page is
 * loaded in a browser enforcing it, and any violation the browser reports fails the test.
 */

const DOCUMENT_CSP_DIRECTIVES = [
  "default-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
];

function expectStaticHeaders(response: APIResponse) {
  const headers = response.headers();
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["permissions-policy"]).toContain("microphone=()");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
  // ADR-0012: never public, never indexed, on every response and not just the document.
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
}

test.describe("security headers", () => {
  test("the document carries the policy, the static headers, a nonce, and integrity attributes", async ({
    request,
  }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    expectStaticHeaders(response);

    const csp = response.headers()["content-security-policy"];
    expect(csp).toBeDefined();
    for (const directive of DOCUMENT_CSP_DIRECTIVES) {
      expect(csp, directive).toContain(directive);
    }
    // Production build: no eval.
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("unsafe-inline");

    // The nonce in the header is the nonce on the scripts. If Next did not receive the
    // header at render time, the scripts carry no nonce and the policy blocks them all.
    const nonce = /'nonce-([^']+)'/.exec(csp!)?.[1];
    expect(nonce).toBeDefined();
    const html = await response.text();
    const scriptTags = html.match(/<script\b[^>]*>/gi) ?? [];
    expect(scriptTags.length).toBeGreaterThan(0);
    const nonced = scriptTags.filter((tag) => tag.includes(`nonce="${nonce}"`));
    expect(nonced.length, "every script tag carries the request's nonce").toBe(
      scriptTags.length,
    );

    // Subresource Integrity. What Next's `experimental.sri` covers, stated exactly: the
    // framework entry scripts and the polyfill carry `integrity`; the client-component
    // chunks React preloads from the RSC manifest do not, under Turbopack or webpack —
    // verified by building with both. The gap is `fieldnote-9gp`. What is asserted is
    // that SRI is on, that it covers every script Next emits directly, and that every
    // uncovered script is a same-origin chunk rather than anything external. Only the
    // `src` is matched: Next 16.3.2 emitted `crossorigin=""` on the preloaded chunks and
    // 16.3.4 does not, and the attribute shape is Next's to change. The nonce on every
    // script is asserted above.
    const external = scriptTags.filter((tag) => /\bsrc=/.test(tag));
    expect(external.length).toBeGreaterThan(0);
    const withIntegrity = external.filter((tag) =>
      /integrity="sha256-[A-Za-z0-9+/=]+"/.test(tag),
    );
    const without = external.filter((tag) => !/integrity="sha256-/.test(tag));
    expect(withIntegrity.length, "SRI is on").toBeGreaterThan(0);
    for (const tag of without) {
      expect(
        tag,
        "an uncovered script is a preloaded client chunk on this origin",
      ).toMatch(/\bsrc="\/_next\/static\/chunks\/[^"]+"/);
    }
  });

  test("a fresh request gets a fresh nonce", async ({ request }) => {
    const first = (await request.get("/")).headers()["content-security-policy"];
    const second = (await request.get("/")).headers()["content-security-policy"];
    expect(first).not.toBe(second);
  });

  test("the generation route carries the headers too", async ({ request }) => {
    // No access cookie, so the route refuses with 401 before it reads anything (ADR-0012)
    // and nothing reaches the model. That makes the status the same everywhere, which it
    // was not before: this case used to accept either 400 or 500 depending on whether the
    // model key happened to be defined. What is under test here is that the route's
    // responses carry the headers, whatever the route decides.
    const response = await request.post("/api/generate", {
      headers: { "content-type": "application/json" },
      data: "not json",
    });
    expect(response.status()).toBe(401);
    expectStaticHeaders(response);
    expect(response.headers()["content-security-policy"]).toContain("connect-src 'self'");
  });

  test("robots.txt disallows everything and carries the headers", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Disallow: /");
    expectStaticHeaders(response);
  });

  test("the policy blocks an unnonced third-party script, which is what the toolbar is", async ({
    page,
  }) => {
    // ADR-0012 turns the Vercel Toolbar off in project settings, and its own documentation
    // says it needs `script-src https://vercel.live` to run. This asserts the other half
    // rather than reasoning about it: with `'strict-dynamic'` and a per-request nonce, a
    // script element added for a third-party origin does not execute and the browser
    // reports a violation. Nothing here contacts vercel.live; what is under test is the
    // policy's behaviour against the class of thing an injected toolbar is.
    // The script is put into the served HTML, not added with `page.evaluate`. That
    // distinction is the whole test: `'strict-dynamic'` deliberately lets a script that
    // already passed the nonce check load further scripts, so injecting one from an
    // evaluated context is the case the policy allows and proves nothing. A platform that
    // injects a toolbar writes a tag into the markup, which is parser-inserted and needs
    // a nonce of its own — and does not have one.
    const TOOLBAR = "https://vercel.live/_next-live/feedback/feedback.js";
    await page.route("**/", async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(
        "</head>",
        `<script src="${TOOLBAR}"></script></head>`,
      );
      // The original headers are kept, so the policy and its nonce are the real ones.
      await route.fulfill({ response, body: html });
    });

    const violations: string[] = [];
    await page.exposeFunction("recordViolation", (detail: string) => {
      violations.push(detail);
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        (window as unknown as { recordViolation: (d: string) => void }).recordViolation(
          `${event.violatedDirective} ${event.blockedURI}`,
        );
      });
    });

    await page.goto("/");
    await expect
      .poll(() => violations.filter((v) => v.startsWith("script-src")), {
        timeout: 10_000,
      })
      .not.toHaveLength(0);
    expect(violations.filter((v) => v.startsWith("script-src")).join("\n")).toContain(
      "vercel.live",
    );
  });

  test("the worker and the manifest are covered", async ({ request }) => {
    for (const path of ["/sw.js", "/manifest.webmanifest"]) {
      const response = await request.get(path);
      expect(response.ok(), path).toBe(true);
      expectStaticHeaders(response);
      expect(response.headers()["content-security-policy"], path).toContain(
        "connect-src 'self'",
      );
    }
  });

  test("the browser enforces the policy and reports no violation", async ({ page }) => {
    // A policy can be present and still wrong — a missing nonce, a blocked style — and
    // only a browser enforcing it can say. Violations arrive as `securitypolicyviolation`
    // events on the document and as console errors; both are collected.
    const violations: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        const detail = `${event.violatedDirective} ${event.blockedURI}`;
        (window as unknown as { __cspViolations: string[] }).__cspViolations ??= [];
        (window as unknown as { __cspViolations: string[] }).__cspViolations.push(detail);
      });
    });
    page.on("console", (message) => {
      if (message.type() === "error" && /Content Security Policy/i.test(message.text())) {
        violations.push(message.text());
      }
    });

    await page.goto("/");
    await expect(
      page.getByTestId("capture-dock").or(page.getByTestId("event-name")),
    ).toBeVisible();

    const reported = await page.evaluate(
      () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [],
    );
    expect([...violations, ...reported]).toEqual([]);
  });
});
