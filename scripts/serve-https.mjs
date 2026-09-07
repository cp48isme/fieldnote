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
 * WHAT THIS DOES INSTEAD. Generates a small local certificate authority, signs a server
 * certificate with it whose SAN includes this machine's LAN address, and proxies HTTPS to
 * `next start` on loopback. No new dependency: `openssl` ships with macOS, and `node:https`
 * does the rest. Nothing is installed into any trust store on this machine — the phone
 * trusts the CA explicitly, once, which is the same decision made visibly rather than
 * silently.
 *
 * WHY A CA RATHER THAN ONE SELF-SIGNED CERTIFICATE. This served a single self-signed leaf
 * until it was tried on an iPhone. The configuration profile installs, and then
 * Settings → General → About → Certificate Trust Settings lists nothing to enable: that
 * screen enumerates *trust anchors*, and a leaf with `CA:FALSE` is not one, so full trust
 * can never be granted to it. An untrusted certificate blocks service worker registration
 * outright, so the app reads as broken rather than as untrusted. A CA can be an anchor, so
 * it appears there and can be trusted. See docs/TESTING-ON-DEVICE.md.
 *
 * The split has a second benefit worth knowing: the leaf is reissued automatically when
 * this machine's LAN address changes, and because the phone trusts the *CA*, that costs
 * nothing on the phone. Under the old single-certificate design a new network meant
 * re-trusting by hand — or, worse, silently serving a certificate whose SAN no longer
 * matched the URL.
 *
 * Usage:
 *   pnpm build && pnpm start &      # the production build, on loopback
 *   node scripts/serve-https.mjs    # this, in front of it
 *
 * See docs/TESTING-ON-DEVICE.md for the iOS certificate trust steps.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { networkInterfaces } from "node:os";
import { join } from "node:path";

const TARGET_PORT = Number(process.env.TARGET_PORT ?? 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 3443);
const CERT_DIR = "certificates";

/** The trust anchor. This is the file that goes on the phone. */
const CA_CERT_PATH = join(CERT_DIR, "ca.pem");
const CA_KEY_PATH = join(CERT_DIR, "ca-key.pem");

/** The server certificate. This one never leaves the machine. */
const CERT_PATH = join(CERT_DIR, "lan.pem");
const KEY_PATH = join(CERT_DIR, "lan-key.pem");

/**
 * 365 days for both.
 *
 * Apple caps TLS *server* certificate lifetimes (398 days at the time of writing) and
 * rejects anything longer outright, so the leaf cannot simply be given a decade. Keeping
 * the CA on the same clock means one expiry to think about rather than two silently
 * drifting apart — the failure mode of a long-lived CA and a short-lived leaf is a setup
 * that works for a year and then fails in a way that looks like the app.
 */
const DAYS = "365";

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
 * Writes the certificate authority that the phone will trust.
 *
 * `CA:TRUE` is what makes this eligible to be a trust anchor, which is the entire reason
 * this file exists in two parts rather than one. `pathlen:0` says it may sign end-entity
 * certificates and nothing else — this CA signs exactly one thing and there is no reason
 * to leave it able to mint another CA.
 */
function ensureCertificateAuthority() {
  if (existsSync(CA_CERT_PATH) && existsSync(CA_KEY_PATH)) return false;

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
      DAYS,
      "-keyout",
      CA_KEY_PATH,
      "-out",
      CA_CERT_PATH,
      "-subj",
      "/CN=Fieldnote local device testing CA",
      "-addext",
      "basicConstraints=critical,CA:TRUE,pathlen:0",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
    ],
    { stdio: "ignore" },
  );
  return true;
}

/** Whether the existing server certificate still covers the address we are about to serve. */
function certificateCovers(host) {
  try {
    const text = execFileSync("openssl", ["x509", "-in", CERT_PATH, "-noout", "-text"], {
      encoding: "utf8",
    });
    return new RegExp(`IP Address:${host.replaceAll(".", "\\.")}(,|\\s|$)`, "m").test(
      text,
    );
  } catch {
    // Unreadable or not a certificate. Reissuing is always safe; guessing is not.
    return false;
  }
}

/**
 * Writes a server certificate signed by the CA, covering loopback and the LAN address.
 *
 * The SAN is the whole point: a certificate without the address in it is rejected on name
 * mismatch regardless of whether it is trusted, which is the failure mode that makes this
 * look like an app problem rather than a certificate problem. So a leaf that no longer
 * covers this machine's address is reissued rather than reused — moving between networks is
 * ordinary, and the phone's trust is in the CA and survives it.
 *
 * `extendedKeyUsage=serverAuth` is not decoration. Apple requires TLS server certificates
 * to carry it, and a certificate missing it can fail *after* trust has been granted, which
 * is the most confusing order for these things to fail in.
 *
 * LibreSSL ships with macOS and its `x509` has no `-addext`, so the extensions go through a
 * temporary file rather than the command line. It lives in the gitignored certificate
 * directory and is removed either way.
 */
function ensureServerCertificate(host) {
  if (existsSync(CERT_PATH) && existsSync(KEY_PATH) && certificateCovers(host))
    return false;

  mkdirSync(CERT_DIR, { recursive: true });
  const csrPath = join(CERT_DIR, "lan.csr");
  const extensionsPath = join(CERT_DIR, "lan.ext");

  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        KEY_PATH,
        "-out",
        csrPath,
        "-subj",
        "/CN=Fieldnote local device testing",
      ],
      { stdio: "ignore" },
    );

    writeFileSync(
      extensionsPath,
      [
        "basicConstraints=critical,CA:FALSE",
        "keyUsage=critical,digitalSignature,keyEncipherment",
        "extendedKeyUsage=serverAuth",
        `subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${host}`,
        "",
      ].join("\n"),
    );

    execFileSync(
      "openssl",
      [
        "x509",
        "-req",
        "-in",
        csrPath,
        "-CA",
        CA_CERT_PATH,
        "-CAkey",
        CA_KEY_PATH,
        "-CAcreateserial",
        "-days",
        DAYS,
        "-extfile",
        extensionsPath,
        "-out",
        CERT_PATH,
      ],
      { stdio: "ignore" },
    );
  } finally {
    rmSync(csrPath, { force: true });
    rmSync(extensionsPath, { force: true });
  }
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

const generatedAuthority = ensureCertificateAuthority();
const generatedCertificate = ensureServerCertificate(host);

// Only the leaf is served. The CA is the anchor the phone already holds, and sending a
// root back to a client that trusts it adds nothing.
createHttpsServer(
  { key: readFileSync(KEY_PATH), cert: readFileSync(CERT_PATH) },
  proxy,
).listen(HTTPS_PORT, "0.0.0.0", () => {
  const provenance = (generated) =>
    generated ? "  (generated just now)" : "  (existing)";
  process.stdout.write(
    `\n  Fieldnote over HTTPS\n\n` +
      `  On this machine:  https://localhost:${HTTPS_PORT}\n` +
      `  On the phone:     https://${host}:${HTTPS_PORT}\n` +
      `  Proxying to:      http://127.0.0.1:${TARGET_PORT}\n` +
      `  Authority:        ${CA_CERT_PATH}${provenance(generatedAuthority)}\n` +
      `  Certificate:      ${CERT_PATH}${provenance(generatedCertificate)}\n` +
      `\n  Put ${CA_CERT_PATH} on the phone — the authority, not the certificate.\n` +
      `  iOS must be told to trust it before the service worker will register at\n` +
      `  all, and only an authority can be trusted — docs/TESTING-ON-DEVICE.md.\n\n`,
  );
});

// Deliberately no plain-HTTP listener alongside this. An http:// fallback is the failure
// this whole file exists to prevent: it is the origin the app rejects, and offering it is
// how you end up testing the thing you were trying to avoid.
