# Field Follow-Up — Project Plan

**Project:** Fieldnote (`fieldnote`)
**Owner:** cp48isme
**Primary user:** one field representative running mobile demo events
**Status:** Phase 0 complete, Phase 1 in progress
**Date:** August 2026 — revised 2026-09-01

> **Revision note, 2026-09-01.** §3.1, §5, §6, and §7 were revised after Phase 0
> shipped, to correct the stack description against what was actually built and to
> record two decisions taken at the start of session 2 (ADR-0004, ADR-0005). The
> substance of §1–§4 is unchanged.
>
> "Truck Log" was the prototype's working title and is retained only in the history.
> The repository, and the system, are Fieldnote.
>
> **Revision note, 2026-09-02.** Three corrections from session 3, each marked inline
> where it applies: §3.1's heading implied the capture surface would be rebuilt from the
> prototype, and it was not; §5 moves shadcn/ui from session 3 to session 8, the first
> session that needs its primitives; and §7's claim that the private material was already
> gitignored was false when written, and is now true.

---

## 1. The decision that shapes everything else

You want two things from this build, and they pull in opposite directions.

**Goal A** is a tool the representative actually uses at real events with real surgeons.
**Goal B** is a public portfolio piece that demonstrates senior-grade AI governance work.

These conflict. A public GitHub repo containing a named medical device, a named
manufacturer, a real rep's writing voice, and a workflow for communicating with
identifiable physicians is a problem on four fronts at once: trademark use without
authorization, disclosure of an employer's commercial process, retention of
communications that are discoverable in litigation or an Open Payments inquiry, and
personal data about physicians sitting in a repo you control.

The resolution is to build one codebase and two configurations. **Decided 2026-08-27;
recorded as ADR-0001.**

### The public build — `fieldnote`

Generic, unbranded, synthetic. No manufacturer name, no product name, no real people.
The domain is "a field representative who runs demonstration events for regulated
products and needs to follow up with attendees." Seed data is a fictional company with
fictional attendees. Everything about the engineering, the governance, and the
compliance architecture is real and fully visible.

This is the resume artifact. It's stronger de-branded, not weaker — a reviewer sees a
system designed for a regulated domain rather than one person's spouse's job.

### The private build — a private fork

Same code, different config: real branding, real voice profile, real events. Never
public, never indexed, and only after the conversation in §2 has happened.

**Everything below applies to both unless marked otherwise.**

---

## 2. The thing to resolve before writing production code

The representative is an employee. This tool would process her employer's commercial data, generate
communications to healthcare professionals in her territory, and run on infrastructure
you own.

Four issues, in descending order of severity.

**Promotional review.** In medtech, materials directed at healthcare professionals
that describe a product typically require review and approval before use — the
medical/regulatory/legal process. A tool that generates novel HCP-facing prose at
send time routes around that process entirely. This is the single largest compliance
exposure in the build, and §4 addresses it architecturally.

**Records and discoverability.** Communications between a manufacturer's representative
and physicians are business records. If they're drafted in a system the employer
doesn't control, the employer can't preserve, search, or produce them. That is a real
problem in an investigation or a litigation hold, and it's the kind of thing that
becomes someone's very bad quarter.

**Personal data about physicians.** Names, specialties, institutions, clinical
interests, procurement influence, and — under the planning feature — photographs.
That is a profile of an identifiable person, assembled without their knowledge, held
on personal infrastructure. §4 addresses this too.

**Acceptable use.** Many companies now have an AI-use policy that governs exactly this.
It may permit the tool outright, permit it with conditions, or prohibit it.

**Recommendation.** The representative raises it with her manager and whoever owns compliance for
her region, framed accurately: a personal productivity tool that drafts her own
follow-up correspondence for her review, with no automated sending, no connection to
company systems, and a documented control set. That framing is true and it's a much
easier conversation than the one that starts after someone notices.

Build the public version now regardless. It doesn't depend on the answer.

---

## 3. Product scope

Four surfaces. The prototype covered the first.

### 3.1 Capture and follow-up (prototyped, then rebuilt from this section)

Fast in-field capture, batch drafting in her voice, action extraction, card shortlist,
nightly debrief, cross-event pattern analysis.

> **Amended 2026-09-02, session 3.** The heading read "built, needs rebuilding properly",
> which implied the rebuild would start from the prototype. It did not. The prototype was
> a Claude artifact outside this repository, it was not retrieved, and session 3 built the
> capture surface from the four sentences above. The prototype's real value was that it
> was used at an actual event, and that validation does not transfer to a layout derived
> from a feature list — so the capture surface as it stands is unvalidated, and the design
> decisions taken in its absence are recorded in that session's PR.

**Fixes from the prototype test:**

- **Persistence.** The prototype held everything in memory and lost it on any
  interruption. v1 is local-first: every keystroke debounced to IndexedDB, restored on
  load, with an explicit "recovered unsaved session" state. This is the highest-priority
  fix — everything else is worthless if a closed tab wipes the afternoon.
- **Roster import.** Excel and CSV upload, parsed entirely in the browser via
  `read-excel-file` (see ADR-0003; the original SheetJS dependency was replaced during
  Phase 0). Column mapping UI, because sign-in sheets never have the same headers twice.
  The file never leaves the device.
- **Draft generation** moves server-side so the API key isn't in the client.

**Dictated capture** uses the device keyboard's own dictation. The application records
no audio and integrates no transcription service; dictated input reaches it as text and
is treated as untrusted. See ADR-0005.

### 3.2 Event planning — internal briefing (new)

A styled PDF the representative generates and sends to her team before an event.

Contents: event dossier (date, location, configuration, objectives); attendee profiles
with photo, specialty, institution, prior interaction history, and a suggested opener;
approved talking points; logistics with a site map; staffing roles; contact cards with
photos and numbers for the truck operator, the site coordinator, and the representative herself;
contingency plan.

Two constraints matter here.

Talking points are **selected, never authored**. The model picks from an approved
content library the representative loads; it does not write product messaging. See §4.2.

Attendee photos are **uploaded by the representative, not fetched**. No scraping of hospital
directories. The system will not go find a picture of a surgeon, because a tool that
assembles dossiers on named individuals from the open web is a different product with
a much worse risk profile, and I'm not building that.

**Deliverable:** PDF. It gets forwarded, printed, and read on a phone in a parking lot.

### 3.3 Event planning — pre-event communication (new)

An email to registered attendees before the event.

- Logistics: arrival window, time commitment, what to wear, what to expect
- **Location that actually works.** Address plus coordinates, rendered as one-tap
  universal links for Apple Maps and Google Maps, plus an optional uploaded site map
  image for the "we're in the north lot behind Building C" problem that no map app
  solves. Coordinates matter more than the address — a truck in a parking lot is not
  at the building's street address.
- **Calendar attachment.** A generated `.ics` file. Nobody does this and everybody
  should. It's the single highest-conversion element in the email.
- Product information: approved content only, per §4.2.
- Optional invite feature: see §3.4.

### 3.4 The invite feature — analysis and recommendation

You flagged this as needing thought. It does. Here's the honest read.

There are three possible designs, in ascending order of risk.

**Design A — forwardable invitation.** The registered surgeon receives a pre-written
message they can forward or text themselves. Any resulting interest arrives at the representative
through her normal intake. The manufacturer never contacts anyone who didn't ask.

**Design B — rep-sent invitation on referral.** The surgeon supplies a colleague's
name and address; the system drafts and the representative sends. This is a manufacturer's
representative initiating promotional contact with a physician who has not opted in.
It creates a targeting record and, depending on jurisdiction and channel, may run into
communication-consent rules on top of the promotional review question.

**Design C — automated referral chain.** Recipients can invite further recipients
without the representative in the loop. No.

**Decision: Design A, defaulted off. Decided 2026-08-27; recorded as ADR-0002.**

The representative enables it per event. The forwardable message contains logistics and approved
content only. There is no tracking pixel, no referral attribution, no incentive for
inviting — an incentive attached to a physician referral in this industry is a
conversation nobody wants to have. Interest routes back through the representative's ordinary
process, which is already an approved path.

Design A gets you nearly all the value. The reason a surgeon brings a colleague is
that they want to, and a good forwardable message is enough. It also *demonstrates
better judgment*, which for your purposes is worth more than the marginal conversion.

Document the rejection of B and C as an ADR. Showing the option you didn't take, and
why, is exactly what distinguishes a governance professional from someone who read a
framework once.

---

## 4. Compliance architecture — the part that's actually the portfolio

Most AI portfolio projects bolt a policy document onto a working app. Yours should
make the governance *load-bearing* — controls that are code, tested in CI, and
demonstrably enforced. Five components.

### 4.1 Pseudonymization at the AI boundary

The only egress from this system is the model API call. Names never cross it.

Before generation, HCP names are replaced client-side with stable tokens (`[HCP_1]`,
`[STAFF_2]`). Specialty, institution type, and the substance of the notes go through;
identity does not. The generated draft comes back with tokens still in place and they
are rehydrated locally.

This costs nothing in output quality — the greeting is templated from the name field
anyway, and the model never needed the name to write the body. It means the personal
data of identifiable physicians stays on the device, and it turns "we send HCP data to
a third-party AI vendor" into "we don't."

Pair it with zero-retention configuration on the API and you have a genuinely strong,
demonstrable data-minimization story. Write it up as a data flow diagram. It's the
single most impressive thing in the repo.

**The single-egress claim is load-bearing and constrains later decisions.** It is the
reason ADR-0005 rejects API transcription: a second egress would not weaken this
section, it would falsify it. Any future proposal that adds a network destination
should be tested against this paragraph first.

### 4.2 Approved-content-only mode for claim-bearing text

Two classes of generated text, with different rules.

**Class 1 — relational.** Thanks, acknowledgment, logistics, references to what the
attendee said. The model writes this freely under the guardrails.

**Class 2 — claim-bearing.** Anything describing the product's characteristics,
indications, or performance. The model may **select and arrange** from an approved
content library the representative loads. It may not author. Output is validated against the library
before it renders, and anything unmatched is blocked, not flagged.

This is the architectural answer to the promotional review problem. Approved copy stays
approved copy. The AI arranges logistics and gratitude, which nobody needs to approve.

### 4.3 Human review gate

No generated content can be sent without passing through review. Drafts carry an
explicit state: `generated` → `reviewed` → `exported`. Export is disabled until a
human has opened the draft. The system never sends anything itself — copy-to-clipboard
only, into her own approved mail client.

This is deliberate, not a limitation. Automated sending would make the tool a
communications system subject to a completely different control regime.

### 4.4 Provenance and audit log

Every generation writes an immutable record: timestamp, model and version, prompt
template version, guardrail ruleset version, input hash, output hash, which flags
fired, whether a human edited before export, and the edit distance between generated
and sent text.

That last field is quietly the most valuable thing in the system. It's a measurable
signal of how much the human is actually reviewing versus rubber-stamping — the
central question in any human-in-the-loop control, and almost nobody instruments it.
Surface it as a dashboard.

Exportable as a CSV for an auditor. Maps directly to EU AI Act Article 12
record-keeping and to NIST AI RMF MEASURE and MANAGE functions.

### 4.5 Adversarial eval suite in CI

This is the differentiator. Build a test corpus of field notes engineered to induce
guardrail failures:

- Notes that invite an efficacy claim ("he asked if it's faster than what he has now")
- Notes containing patient details
- Notes mentioning a meal or travel
- Notes inviting off-label discussion
- Notes requesting pricing
- Prompt injection embedded in dictated text
- Notes in which the attendee makes the claim, to test whether the model echoes it as
  the attendee's statement or adopts it as the sender's

Each case has an assertion. The suite runs in CI on every change to a prompt, guardrail,
or model version. A pull request that weakens a guardrail fails the build.

Cases in the dictated-input class should be written from real dictation artifacts
rather than invented — see §7 and ADR-0005. Synthetic dictation is reliably too clean to
test anything.

Publish the pass rates in the README. An AI governance candidate who ships a red-team
harness against their own system, wired into CI, with published results, is in a
different category from one who writes a policy. This is where you spend your effort.

### 4.6 The document set

Written as engineering artifacts, not compliance theater:

| Document | Purpose |
|---|---|
| `README.md` | What it is, what it deliberately doesn't do, eval results |
| `docs/ARCHITECTURE.md` | System design, data flow diagrams, trust boundaries |
| `docs/AI-SYSTEM-CARD.md` | Model, prompts, guardrails, known failure modes, eval results |
| `docs/THREAT-MODEL.md` | STRIDE, including prompt injection via dictated input |
| `docs/DATA-PROTECTION.md` | DPIA-style assessment, data inventory, retention, minimization |
| `docs/COMPLIANCE-MAP.md` | Controls mapped to NIST AI RMF, EU AI Act, ISO/IEC 42001 |
| `docs/adr/` | Architecture decision records, including the invite-feature rejection |
| `SECURITY.md` | Disclosure policy |
| `CHANGELOG.md` | Keep a Changelog format |

On the EU AI Act mapping: be precise rather than expansive. This system is not
high-risk under Annex III. It is a limited-risk system whose main obligation is
transparency. Saying so accurately, and then voluntarily implementing Article 12-style
logging anyway with a clear rationale, reads as far more competent than overclaiming a
risk tier. Reviewers notice the difference.

The same standard applies to the control set. Where a control listed in §5 was
deliberately not built, the ADR recording that decision is the artifact, and
`THREAT-MODEL.md` and `DATA-PROTECTION.md` should state the residual risk plainly rather
than eliding it. See ADR-0004.

---

## 5. Technical architecture

**Stack — installed as of Phase 0**

- Next.js 16 (App Router), TypeScript in strict mode
- Tailwind v4
- `read-excel-file` for client-side spreadsheet parsing (ADR-0003)
- pnpm, Vitest for unit tests, Playwright for end-to-end, GitHub Actions for CI

**Stack — chosen, not yet installed**

These are decisions, not yet load-bearing code. Dexie and the Anthropic SDK are in
`package.json` but nothing imports them; the rest are not installed at all. Each
becomes real with the session that needs it.

- Dexie (IndexedDB) for local-first persistence — installed, unused until session 2
- shadcn/ui — session 8, moved from session 3: session 3's capture surface needed none of
  its primitives, and session 8's column-mapping UI is the first that does
- Anthropic API via a route handler, key server-side only — SDK installed, route
  lands session 5
- Custom harness for evals — session 7
- React-PDF or Puppeteer for the briefing PDF — session 11
- Vercel deployment

Keeping these lists separate is the point: a stack section that reads as built when it
is aspirational is the same category of error as an eval badge over an empty suite.

**Non-negotiables**

1. No server-side database of HCP data in v1. Local-first is a security posture, not
   just a convenience.
2. The API route is a stateless pass-through. It logs metadata, never content.
3. No third-party analytics. None. A tool handling physician data does not phone home
   to a marketing SDK.
4. Content Security Policy, Subresource Integrity, strict headers. Table stakes, but a
   reviewer will check — and asserted in CI against a live response, not just present in
   config. Lands with the route handler in session 5.
5. PWA with a service worker so capture works offline in a parking lot with no signal.
   Lands with the capture UI in session 3, and is verified by a hard reload with the
   network disabled — not by toggling the network on an already-loaded page.
6. No audio. The application requests no microphone permission, stores no recordings,
   and integrates no transcription service. Dictation is the device keyboard's, and
   dictated text is untrusted input. See ADR-0005.
7. All persistence routes through a single data-access layer, with `encrypt`/`decrypt`
   hooks and every field classified as encryption-eligible or not. The hooks are
   pass-throughs in the public build; real WebCrypto envelope encryption is private-fork
   only and ships in session 19, gated on a key-recovery story. This replaces the
   original unconditional encryption-at-rest requirement — see ADR-0004 for the threat
   analysis and the availability argument behind the change.

**Data model**

`Event` → `Attendee` → `Note` → `Draft` → `AuditRecord`
plus `VoiceProfile`, `ApprovedContent`, `Settings`

Every record carries `createdAt`, `updatedAt`, and a schema version for migrations.
Every field carries an encryption-eligibility classification, per non-negotiable 7.

---

## 6. Phases

**Phase 0 — foundation.** Repo, CI, doc skeleton, ADR-0001 recording the public/private
split. Nothing works yet; the scaffolding is visible. **Complete, 2026-08-28.**
~2 hours.

**Phase 1 — parity, done properly (week 1–2).** Capture, persistence with crash
recovery, roster import, drafting server-side, pseudonymization boundary, review gate,
audit log, and the first eval cases. Compliance lands with the feature, never after.
~22 hours.

**Phase 2 — planning A (week 3).** Approved content library, attendee profiles, the
briefing PDF. ~8.5 hours.

**Phase 3 — planning B (week 4).** Pre-event email, map links, `.ics` generation,
site map upload, Design A invite behind its flag. ~7 hours.

**Phase 4 — hardening (week 5).** Eval suite to full coverage, threat model, DPIA,
compliance map, published results, demo video. ~12 hours.

**Private fork, off the critical path.** Session 19, encryption at rest over the seam
built in session 2. ~3 hours. Not required for the public build, and gated on the same
§2 conversation that gates private deployment generally.

Roughly six weeks of evenings at three a week; nine to ten at two. Phase 1 alone is a
defensible portfolio piece; don't let Phases 2–4 hold up shipping something real.

---

## 7. What I need from you

§1 and §3.4 are settled — ADR-0001 and ADR-0002 are committed. §5's encryption and
dictation questions are settled as ADR-0004 and ADR-0005. What remains:

1. **8–15 more of the representative's emails**, with range: an enthusiastic recipient, a lukewarm
   one, a department chair, a staff coordinator, and one where she's asking for
   something. Range matters more than volume. One `.md` file, samples separated by
   `---`, each preceded by three lines: recipient role, what it followed, and how warm
   they were. Whole emails — subject line and sign-off included, because the sign-off is
   voice. Names placeholdered (`[Dr. A]`, `[Coordinator B]`); the specifics of what each
   person said or asked about are kept, because those are the entire signal.
   **Status: requested, in progress.**
2. **6–10 dictated notes, uncorrected.** Recorded on her phone's keyboard dictation,
   under realistic conditions, and sent exactly as they came out — punctuation,
   homophones, mangled surnames, false starts, and all. These are input material for
   sessions 4, 7, and 15, which all depend on knowing what real dictation produces.
   See ADR-0005. **Status: to request.**
3. **Status on §2** — has the representative raised it with her manager, or is that still ahead?
   Doesn't block the public build, gates the private one. **Status: open.**
4. **What "approved content" she actually has** — a leave-behind, an approved slide,
   a fact sheet. It determines whether §4.2 is a library-selection feature or just a
   text field she pastes into. Needed by session 9. **Status: open.**

Items 1 and 2 are private-fork material and belong at `private/`, which is gitignored on
the public side. Where dictated notes are adapted into public eval cases, names are
replaced with the synthetic roster per ADR-0001.

> **Amended 2026-09-02, session 3.** This paragraph previously asserted that items 1 and
> 2 were already gitignored. No such rule existed — `.gitignore` covered build output,
> `.denylist.local*`, and `.env*`, and nothing else — so the material had no safe landing
> place and the claim was false from the day it was written. `private/` was added to
> `.gitignore` in the same commit as this amendment, which makes the sentence true and
> names the path rather than leaving it implied.

*(The original item 4 — GitHub handle and public-from-first-commit — was resolved in
Phase 0: `cp48isme`, public from the first commit.)*

---

## 8. Open questions worth your judgment

- Does the representative ever need to hand the tool to a colleague? Multi-user changes the auth
  and data-residency picture substantially. Assume no for v1.
- Do you want the audit log exportable to a format her compliance team could actually
  ingest, or is CSV enough? Building for the former is a nice flourish.
- How much do you want to invest in the voice profile versus letting her edit? There's
  a real ceiling on style matching, and past a point her editing pass is faster than
  another round of prompt work.
- What retention policy does the local store get? ADR-0004 leans on "the device holds
  two events, not two years" as a mitigation for accepted residual risk, which means
  retention needs to be a real implemented behaviour rather than an assumption. Decide
  before session 16.
