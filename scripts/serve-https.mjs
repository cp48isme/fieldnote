#!/usr/bin/env node
/**
 * Serves a production build over HTTPS on the local network, for testing on a phone.
 *
 * WHY THIS EXISTS. Three things this project depends on are only available in a secure
 * context: `crypto.randomUUID` for every record id, `navigator.serviceWorker` for the
 * offline shell, and `crypto.subtle` for session 19. A phone reaching this machine at
 * `http://<LAN-IP>:3000` has none of them, and the app refuses to run there on purpose.
 *
 * WHY NOT `next dev --experimental-https`. Two reasons, both established by running it:
 *
 *   1. It is `next dev` only — `next start` has no HTTPS option — and the service worker
 *      registers only in production builds and needs `public/precache.json`, which
 *      `next build` produces. So the dev server can give a secure context but never the
 *      offline shell or the install path, which are the things worth testing on a phone.
 *   2. Its certificate does not cover the LAN address. Next invokes mkcert with a
 *      hard-coded host list (`next/dist/lib/mkcert.js`): `localhost`, `127.0.0.1`, `::1`,
 *      plus `--hostname` if you pass one. Safari rejects a certificate whose SAN does not
 *      cover the address in the URL even when the CA is trusted, so without
 *      `--hostname <LAN-IP>` it cannot work from a phone at all.
 *
 * It also needs `mkcert -install`, which writes to the system trust store and prompts for
 * a password. When that fails, `next dev` **falls back to plain HTTP and keeps running** —
 * so the flag can appear to work while serving the exact origin the app rejects.
 *
 * WHAT THIS DOES INSTEAD. Generates a self-signed certificate whose SAN includes this
 * machine's LAN address, and proxies HTTPS to `next start` on loopback. No new dependency:
 * `openssl` ships with macOS, and `node:https` does the rest. Nothing is installed into any
 * trust store — the phone trusts this certificate explicitly, once, which is the same
 * decision made visibly rather than silently.
 *
 * Usage:
 *   pnpm build && pnpm start &      # the production build, on loopback
 *   node scripts/serve-https.mjs    # this, in front of it
 *
 * See docs/TESTING-ON-DEVICE.md for the iOS certificate trust steps.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { networkInterfaces } from "node:os";
import { join } from "node:path";

const TARGET_PORT = Number(process.env.TARGET_PORT ?? 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 3443);
const CERT_DIR = "certificates";
const CERT_PATH = join(CERT_DIR, "lan.pem");
const KEY_PATH = join(CERT_DIR, "lan-key.pem");

/** The address a phone on the same network can reach. */
function lanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  return null;
}

/**
 * Writes a self-signed certificate covering loopback and the LAN address.
 *
 * The SAN is the whole point: a certificate without the address in it is rejected on name
 * mismatch regardless of whether it is trusted, which is the failure mode that makes this
 * look like an app problem rather than a certificate problem.
 */
function ensureCertificate(host) {
  if (existsSync(CERT_PATH) && existsSync(KEY_PATH)) return false;

  mkdirSync(CERT_DIR, { recursive: true });
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "365",
      "-keyout",
      KEY_PATH,
      "-out",
      CERT_PATH,
      "-subj",
      "/CN=Fieldnote local device testing",
      "-addext",
      `subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${host}`,
      "-addext",
      "basicConstraints=critical,CA:FALSE",
    ],
    { stdio: "ignore" },
  );
  return true;
}

function proxy(clientRequest, clientResponse) {
  const upstream = httpRequest(
    {
      host: "127.0.0.1",
      port: TARGET_PORT,
      method: clientRequest.method,
      path: clientRequest.url,
      headers: clientRequest.headers,
    },
    (upstreamResponse) => {
      clientResponse.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers,
      );
      upstreamResponse.pipe(clientResponse);
    },
  );

  upstream.on("error", (cause) => {
    // Almost always "the production build is not running". Say that rather than dumping a
    // stack, because the fix is one command.
    clientResponse.writeHead(502, { "content-type": "text/plain" });
    clientResponse.end(
      `Cannot reach the app on http://127.0.0.1:${TARGET_PORT}.\n` +
        `Start it first:  pnpm build && pnpm start\n\n${cause.message}\n`,
    );
  });

  clientRequest.pipe(upstream);
}

const host = lanAddress();
if (!host) {
  process.stderr.write(
    "serve-https: no non-internal IPv4 address found. Are you on a network?\n",
  );
  process.exit(1);
}

const generated = ensureCertificate(host);

createHttpsServer(
  { key: readFileSync(KEY_PATH), cert: readFileSync(CERT_PATH) },
  proxy,
).listen(HTTPS_PORT, "0.0.0.0", () => {
  process.stdout.write(
    `\n  Fieldnote over HTTPS\n\n` +
      `  On this machine:  https://localhost:${HTTPS_PORT}\n` +
      `  On the phone:     https://${host}:${HTTPS_PORT}\n` +
      `  Proxying to:      http://127.0.0.1:${TARGET_PORT}\n` +
      `  Certificate:      ${CERT_PATH}` +
      (generated ? "  (generated just now)" : "  (existing)") +
      `\n\n  The certificate is self-signed. iOS must be told to trust it before the\n` +
      `  service worker will register at all — docs/TESTING-ON-DEVICE.md.\n\n`,
  );
});

// Deliberately no plain-HTTP listener alongside this. An http:// fallback is the failure
// this whole file exists to prevent: it is the origin the app rejects, and offering it is
// how you end up testing the thing you were trying to avoid.
