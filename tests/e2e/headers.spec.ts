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
    // A malformed body, so nothing reaches the model and no key is needed. What is under
    // test is that the route's responses are covered, not what it generates. The status
    // depends on the environment: with the key defined the route rejects the body (400);
    // on a CI runner, where the key is deliberately absent, it refuses before reading the
    // body and names the variable (500). Both are the route working, and both responses
    // must carry the headers. The first CI run of this suite found the 500 path.
    const response = await request.post("/api/generate", {
      headers: { "content-type": "application/json" },
      data: "not json",
    });
    expect([400, 500]).toContain(response.status());
    expectStaticHeaders(response);
    expect(response.headers()["content-security-policy"]).toContain("connect-src 'self'");
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
