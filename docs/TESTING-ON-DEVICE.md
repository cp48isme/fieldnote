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

## The setup

```
pnpm build && pnpm start      # the production build, on loopback
pnpm serve:https              # HTTPS in front of it, in a second terminal
```

`scripts/serve-https.mjs` generates a self-signed certificate covering this machine's LAN
address and proxies HTTPS to `next start`. No new dependency — `openssl` ships with macOS
and `node:https` does the rest. It prints the URL to open on the phone. Both devices need
to be on the same network.

**Verified end to end** against the LAN address with the certificate trusted:
`isSecureContext` true, `crypto.randomUUID` present, service worker activated with a full
precache, capture working, and an offline reload afterwards returning the note intact.

### Why not `next dev --experimental-https`

It is the obvious answer and it does not work. Three separate reasons, each established by
running it rather than by reading about it:

1. **It cannot give you the service worker.** `--experimental-https` exists only on
   `next dev` (`next start --help` has no HTTPS option), and the worker registers only in
   production builds — it needs `public/precache.json`, which `scripts/build-service-worker.mjs`
   writes after `next build`. So the dev server can give a secure context but never the
   offline shell or the install path, which are the things worth going to a phone for.

2. **Its certificate does not cover the LAN address.** Next invokes mkcert with a
   hard-coded host list — `next/dist/lib/mkcert.js` lines 164–169:

   ```js
   const defaultHosts = ['localhost', '127.0.0.1', '::1'];
   const hosts = host && !defaultHosts.includes(host) ? [...defaultHosts, host] : defaultHosts;
   ```

   Safari rejects a certificate whose SAN does not cover the address in the URL **even when
   the CA is trusted**, so from a phone this fails on name mismatch before trust is even
   consulted. Passing `--hostname <LAN-IP>` is what would add it.

3. **It fails here, and fails quietly.** `mkcert -install` writes to the system trust store
   and prompts for a password; when that does not happen, Next logs
   `Failed to generate self-signed certificate. Falling back to http.` **and keeps
   running.** The banner then advertises `http://…`, which is exactly the origin the app
   rejects. A flag that silently serves the thing you were trying to avoid is worse than
   one that fails.

## Trusting the certificate on iOS

A self-signed certificate is untrusted by default, and iOS is strict about it. **An
untrusted certificate blocks service worker registration outright rather than degrading**,
so a half-finished trust setup reads as "the PWA doesn't work" rather than "the certificate
isn't trusted."

That is not a guess. The first verification run of the setup above used a browser told to
*ignore* certificate errors rather than to trust the certificate, and
`navigator.serviceWorker.ready` never resolved — it hung until the harness timed out.
Ignoring an error is not the same as trusting the certificate, and only the second makes a
service worker possible.

The failure mode is the right way round — loud at setup rather than silent in the field —
but only if you know to expect it.

The procedure, in order:

1. Run `pnpm serve:https` once. It writes `certificates/lan.pem` and `certificates/lan-key.pem`
   (both gitignored; the key must never be committed).
2. Get **`certificates/lan.pem`** onto the phone — AirDrop, or email it to yourself.
3. On the phone: **Settings → General → VPN & Device Management**, and install the
   downloaded profile.
4. **Then, separately: Settings → General → About → Certificate Trust Settings**, and
   enable full trust for it. This second step is easy to miss and nothing works without it —
   iOS installs a profile and still does not trust it until you say so here.
5. Confirm in Safari that the URL loads with no interstitial before concluding anything
   about the app.

### Still unverified

Steps 2 to 5 have not been run on a physical iOS device. They are the documented iOS trust
flow, not a transcript. What *has* been verified is everything they depend on: the
certificate exists, its SAN covers the LAN address, and with that certificate trusted the
service worker registers and the offline shell works.

The remaining risk is iOS-specific handling of a self-signed **leaf** certificate — the
steps above install the server certificate itself rather than a CA that signed it, which
iOS accepts but treats slightly differently in the trust UI. If step 4 offers nothing to
enable, that is the reason, and the fix is to generate a small CA and a certificate signed
by it instead. Correct this section with what actually happens, on the session that first
does it.

## Why this is a document rather than a bead

A bead is internal build state and gets closed; when `fieldnote-bdw` closes, instructions
living inside it stop being findable. The build guide is a plan of sessions, not a runbook.
This is durable operational knowledge that outlives the task that needed it, so it gets a
file, and `fieldnote-bdw` points at the file.
