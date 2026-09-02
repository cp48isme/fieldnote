# Testing on a real device

How to run Fieldnote on a phone over the local network, and why it is more involved than
pointing the phone at `http://<LAN-IP>:3000`.

This exists because several things this project asserts can only be checked on a real
device — the capture dock sitting above the software keyboard, iOS zoom behaviour on
focus, and the home-screen install path that `fieldnote-bdw` says the storage-durability
argument depends on — and none of them can be checked over plain HTTP.

## Why plain HTTP does not work

A browser only exposes some APIs in a **secure context**: HTTPS, or `localhost`. A phone
reaching this machine at `http://192.168.1.x:3000` is neither.

Three things go missing there, and this project needs all three:

| API | Used for | Effect when absent |
|---|---|---|
| `crypto.randomUUID` | every record id (`src/lib/db/repository.ts`) | the first write throws |
| `navigator.serviceWorker` | the offline shell (plan §5 non-negotiable 5) | no offline capture |
| `crypto.subtle` | session 19's encryption, private fork | not yet reached |

The app detects this and refuses to run, rather than starting and failing later — see
`SecureContextGate`. That notice appearing is correct behaviour on a plain-HTTP origin and
a signal that something is wrong anywhere else.

**There is deliberately no fallback id generator.** It was considered and rejected: it
would leave permanently unexercised code in the tree, and it would mean every device test
ran against a build that differs from production in the data layer. The decision is to fix
the origin, not the code.

## Running over HTTPS

```
pnpm exec next dev --experimental-https
```

Next generates a self-signed certificate and serves over HTTPS. Verified: the flag exists
on `next dev` (`pnpm exec next dev --help`).

Then reach it from the phone at `https://<LAN-IP>:3000`, with both devices on the same
network.

### What this does and does not get you

**It does** give a secure context, so `crypto.randomUUID` works and capture runs. That
covers the session 3 behaviour that has never been verified on hardware: the `100dvh`
column, the sticky dock against the software keyboard, 16px inputs and iOS zoom on focus,
and hit-target sizes under a thumb.

**It does not** get you the service worker. `next dev` has no
`public/precache.json` — that file is written by `scripts/build-service-worker.mjs` after
`next build` — and registration is gated to production builds anyway, because dev asset
URLs change on every recompile and a cache-first worker breaks hot reload.

So **the offline shell and the home-screen install path cannot be verified this way**, and
those are precisely what `fieldnote-bdw` needs. `next start` has no HTTPS option
(`pnpm exec next start --help`, verified), so serving a production build over HTTPS needs a
TLS proxy in front of it. Tracked as `fieldnote-xxz`.

## Trusting the certificate on iOS

A self-signed certificate is untrusted by default, and iOS is strict about it. **This
matters more than it sounds: an untrusted certificate blocks service worker registration
outright rather than degrading**, so a half-finished trust setup looks like "the PWA
doesn't work" rather than "the certificate isn't trusted."

That failure mode is the right way round — it fails loudly at setup rather than silently in
the field — but only if you know to expect it.

The procedure, in order:

1. Generate the certificate by running the command above once. Next writes it under
   `certificates/` in the project root.
2. Get the **CA certificate** onto the phone — AirDrop, or email it to yourself. It is the
   CA that must be trusted, not the leaf certificate.
3. On the phone: **Settings → General → VPN & Device Management**, and install the
   downloaded profile.
4. **Then, separately: Settings → General → About → Certificate Trust Settings**, and
   enable full trust for the root certificate. This second step is easy to miss and nothing
   works without it — iOS installs a profile and still does not trust it until you say so
   here.
5. Confirm in Safari that `https://<LAN-IP>:3000` loads with no interstitial before
   concluding anything about the app.

### Unverified, and worth knowing before you start

Nothing in this section has been run on a physical iOS device by the session that wrote it.
The steps are the documented iOS trust flow, not a transcript. One specific thing to check
first, because it decides whether any of the rest applies:

**Does the generated certificate list the LAN IP as a Subject Alternative Name?** Safari
rejects a certificate whose SAN does not cover the address in the URL, regardless of
whether the CA is trusted. If Next's certificate covers only `localhost` and `127.0.0.1`,
this whole approach needs a certificate generated with the IP included —
`openssl req -x509 -addext "subjectAltName=IP:<LAN-IP>"` — or `mkcert` with the IP passed
explicitly. Check this before working through the trust steps rather than after.

Correct this file with what actually happens, on the session that first does it.

## Why this is a document rather than a bead

A bead is internal build state and gets closed; when `fieldnote-bdw` closes, instructions
living inside it stop being findable. The build guide is a plan of sessions, not a runbook.
This is durable operational knowledge that outlives the task that needed it, so it gets a
file, and `fieldnote-bdw` points at the file.
