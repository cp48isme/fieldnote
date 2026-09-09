/**
 * Security headers on every response. Plan §5 non-negotiable 4.
 *
 * The Content Security Policy needs a nonce that changes per request, and a nonce can
 * only be minted where a request exists — so it is minted here, in Next's proxy, and the
 * page is rendered dynamically to receive it (`src/app/page.tsx`). Next reads the header
 * off the request, applies the nonce to every framework script and inline chunk it emits,
 * and `experimental.sri` in `next.config.ts` adds an `integrity` attribute to the entry
 * scripts and the polyfill on top. Not to everything: the client-component chunks React
 * preloads from the RSC manifest carry no integrity under either bundler, which
 * `tests/e2e/headers.spec.ts` states and `fieldnote-9gp` tracks. With the nonce, `'strict-dynamic'`,
 * and every script on this origin over TLS, SRI is a second lock on the same door — worth
 * having, not the thing the door depends on. The static headers that do not vary per request are set here too, so one
 * file is the whole answer to "what headers does this app send".
 *
 * TWO DIRECTIVES DO MORE THAN HARDENING.
 *
 *   - `connect-src 'self'` is plan §4.1's single-egress claim, enforced by the browser on
 *     every request the page makes. `tests/unit/single-egress.test.ts` is the grep over
 *     source; this is the runtime check behind it. A second destination added to the code
 *     fails the grep in CI, and if it somehow shipped, the browser refuses the connection.
 *   - `Permissions-Policy: microphone=()` is ADR-0005 made mechanical: the application
 *     cannot ask for the microphone even if a future change tried to.
 *
 * The offline shell depends on this working through the service worker. The worker
 * precaches `/` at install; the cached response carries this header with the nonce of
 * that render, and the cached HTML carries the same nonce on its scripts, so the pair
 * stays consistent when served offline. `tests/e2e/offline.spec.ts` is what proves it.
 *
 * Asserted against a live response in `tests/e2e/headers.spec.ts`; a header config nobody
 * reads again is not a control.
 */

import { NextResponse, type NextRequest } from "next/server";

/**
 * Headers that are the same on every response. Values are chosen for a single-origin
 * application that embeds nothing and is embedded by nothing.
 */
export const STATIC_HEADERS: Readonly<Record<string, string>> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "microphone=(), camera=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/**
 * The policy, with the nonce in it. `'strict-dynamic'` lets scripts the nonced framework
 * loads run without their own nonce, which is how Next's chunk loading works; it also
 * makes `'self'` redundant for scripts in modern browsers but it is kept for older ones.
 * `'unsafe-eval'` is development only: React's dev tooling evaluates source maps for
 * error stacks. Neither React nor Next uses `eval` in production.
 */
export function contentSecurityPolicy(nonce: string, development: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  // Next reads the policy off the *request* to find the nonce it applies to the render.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  for (const [name, value] of Object.entries(STATIC_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

/**
 * Everything except Next's own content-hashed static assets, which are not documents and
 * whose response headers no policy reads. The route, the worker, the manifest, and the
 * icons all pass through here: a request the worker makes for `/precache.json` is
 * covered by `connect-src 'self'` on the worker's own script response.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
