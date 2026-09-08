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

`scripts/serve-https.mjs` generates a small local certificate authority, signs a server
certificate with it covering this machine's LAN address, and proxies HTTPS to `next start`.
No new dependency — `openssl` ships with macOS and `node:https` does the rest. It prints
the URL to open on the phone. Both devices need to be on the same network.

Two files matter and they are not interchangeable:

| File | What it is | Where it goes |
|---|---|---|
| `certificates/ca.pem` | the authority | **this is the one that goes on the phone** |
| `certificates/lan.pem` | the server certificate, signed by the authority | stays on this machine |

Both, and their keys, are gitignored. The keys must never be committed.

**Why two files rather than one** is the subject of the iOS section below, and it was
settled by a phone rather than by reasoning: a single self-signed certificate cannot be
trusted on iOS at all.

The split has a second benefit. Because the phone trusts the *authority*, the server
certificate can be reissued without touching the phone — which is what happens
automatically when this machine's LAN address changes. `serve-https.mjs` reissues the leaf
when the existing one no longer covers the current address, rather than serving a
certificate whose SAN does not match the URL. That mismatch is rejected regardless of
trust, and it presents as an app failure rather than a certificate one.

**Verified end to end** against the LAN address, in two halves, because no single harness
covers both:

- **The trust path**, with the authority as the only anchor: the served certificate
  verifies for the LAN address, and is refused when the authority is withheld
  (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) or when the address is outside the SAN
  (`ERR_TLS_CERT_ALTNAME_INVALID`). Full verification, not a bypass.
- **The browser behaviour**, in headless Chromium: `isSecureContext` true,
  `crypto.randomUUID` and `crypto.subtle` present, service worker activated *and
  controlling* with a 28-entry precache, capture working, and an offline reload afterwards
  returning the note intact.

The reason those are two runs rather than one is worth recording, because it looks like an
omission otherwise. Chromium's `--ignore-certificate-errors-spki-list` matches the **served
certificate's** key only — it does not walk the chain, and passing it the authority's key
still fails with `ERR_CERT_AUTHORITY_INVALID`. So the browser run can show the app working
over TLS but cannot show that the leaf chains to the CA, and the TLS run shows the chain
but not the service worker. Neither half was allowed to stand in for the other. Trusting
the CA in Chromium itself would mean writing to the macOS keychain, which this setup
deliberately does not do.

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

## Trusting the authority on iOS

A locally generated authority is untrusted by default, and iOS is strict about it. **An
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

### It must be the authority, not the server certificate

This is the part that was wrong for a while, and it is worth stating plainly because the
failure gives you no clue.

The first version of this setup served **one self-signed certificate** and told you to put
that on the phone. Tried on an iPhone, it fails: the configuration profile installs
normally, and then **Settings → General → About → Certificate Trust Settings shows nothing
to enable.** No error, no warning, no entry.

That was the first finding in this project to come from a physical device. Everything
before it — the secure-context classification, the service worker, the offline reload — was
reached headlessly, and the first thing hardware decided was that this runbook's own
procedure did not work. It is recorded here as a result, not a hypothesis, for that reason.

The reason is that Certificate Trust Settings enumerates **trust anchors**. A server
certificate is not one — it carries `basicConstraints: CA:FALSE`, which is precisely the
assertion "I am not an authority" — so it can never appear on that screen, and full trust
can never be granted to it. And because an untrusted certificate **blocks service worker
registration outright** rather than degrading, the app then reads as broken rather than as
untrusted.

A certificate authority *can* be an anchor. So `serve-https.mjs` now generates one, signs
the server certificate with it, and the authority is what goes on the phone.

### The procedure, in order

1. Run `pnpm serve:https` once. It writes four files into `certificates/` (all gitignored):
   `ca.pem` and `ca-key.pem`, and `lan.pem` and `lan-key.pem` signed by them.
2. **If you previously installed the old single-certificate profile, remove it first** —
   Settings → General → VPN & Device Management → the profile → Remove Profile. Leaving it
   there is harmless but confusing, since it looks like the thing you just installed.
3. Get **`certificates/ca.pem`** onto the phone — AirDrop, or email it to yourself. **Not
   `lan.pem`.** That is the mistake this whole section exists to prevent.
   - iOS is fussy about extensions: a `.pem` may open as text rather than offering to
     install. Sending it as `.cer` is more reliable —
     `openssl x509 -in certificates/ca.pem -outform der -out certificates/fieldnote-ca.cer`,
     which keeps the copy inside the gitignored directory.
4. On the phone: **Settings → General → VPN & Device Management**, and install the
   downloaded profile.
5. **Then, separately: Settings → General → About → Certificate Trust Settings**, and
   enable full trust for it. This second step is easy to miss and nothing works without it —
   iOS installs a profile and still does not trust it until you say so here. **If the
   authority does not appear on this screen, stop**: something other than `ca.pem` was
   installed. Do not work around it by trusting something else.
6. Confirm in Safari that the URL loads with no interstitial before concluding anything
   about the app.

### Verified on hardware

Walked end to end on a physical iPhone on 2026-09-08, by the owner. Recorded here as what
happened, not as what the procedure says should happen:

- **The trust flow.** The profile installed as *Fieldnote local device testing CA*, the
  authority appeared under Settings → General → About → Certificate Trust Settings, full
  trust was enabled, and the LAN HTTPS URL loaded in Safari with no interstitial. That is
  the positive half `fieldnote-zxo` was waiting on, and it closed the bead. Both halves of
  the leaf-versus-CA question are now hardware results: a leaf offers nothing to trust, an
  authority does.
- **Add to Home Screen.** The icon renders the Fieldnote mark from the SVG manifest icon,
  not a screenshot — there is no `apple-touch-icon` in the tree for it to have used instead
  — and the app opens standalone, with no address bar or toolbar. `fieldnote-lkm`, which
  carried the SVG-icon question, closed on this.
- **Offline, the hard way.** Two notes captured, airplane mode on, the app fully killed
  from the app switcher, reopened from the home-screen icon. The capture screen rendered,
  both notes were there, and a third was captured and saved with no network. Plan §5
  non-negotiable 5 holds on a real device, not only in the headless harness.
- **Correcting dictated text.** A word inserted mid-sentence into an existing note, typing
  continuously, with the caret held through autosave. That is the correction case the
  textarea was designed around, and it had never been exercised against a real software
  keyboard before.

**iOS 26.6.1.** Everything above is true of that version on one phone on one day, and
should be cited that way.

### Still unverified

- **Storage durability across Safari's eviction window.** ITP deletes script-writable
  storage after seven days of Safari use without interaction, home-screen web apps are
  exempt by having their own counter, and none of that has been tested because it needs
  seven days without opening the app. `fieldnote-bdw` is now narrowed to exactly this, and
  records a cheap check worth doing first: evaluate `navigator.storage.persisted()` in the
  installed app through Safari's Web Inspector, which says which of two worlds the wait is
  confirming.
- **Whether the layout is right.** The app was used on hardware by the representative and
  it functions. Nobody observed where she hesitates or what she reaches for that is not
  there, which is the finding `fieldnote-xjs` asks for. A passing hardware run is not that.
- **Anything off this network.** Everything above ran over the LAN from the machine
  serving it, which is a test rig. Real use needs a deployment, and `fieldnote-ijg`
  records that nothing has been deployed and what that leaves unchecked.

Correct this section with what actually happens, on the session that first does any of it.

## Why this is a document rather than a bead

A bead is internal build state and gets closed; when `fieldnote-bdw` closes, instructions
living inside it stop being findable. The build guide is a plan of sessions, not a runbook.
This is durable operational knowledge that outlives the task that needed it, so it gets a
file, and `fieldnote-bdw` points at the file.
