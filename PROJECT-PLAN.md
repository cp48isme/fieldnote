# Fieldnote — Project Plan

**Name:** Fieldnote (public build) / Truck Log (private build)
**Owner:** cp48isme
**Primary user:** one field representative running mobile demo events
**Status:** prototype validated, moving to v1
**Date:** August 2026

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

### 3.1 Capture and follow-up (built, needs rebuilding properly)

Fast in-field capture, batch drafting in her voice, action extraction, card shortlist,
nightly debrief, cross-event pattern analysis.

**Fixes from the prototype test:**

- **Persistence.** The prototype held everything in memory and lost it on any
  interruption. v1 is local-first: every keystroke debounced to IndexedDB, restored on
  load, with an explicit "recovered unsaved session" state. This is the highest-priority
  fix — everything else is worthless if a closed tab wipes the afternoon.
- **Roster import.** Excel and CSV upload, parsed entirely in the browser via SheetJS.
  Column mapping UI, because sign-in sheets never have the same headers twice. The file
  never leaves the device.
- **Draft generation** moves server-side so the API key isn't in the client.

### 3.2 Event planning — internal briefing (new)

A styled PDF the representative generates and sends to her team before an event.

Contents: event dossier (date, location, configuration, objectives); attendee profiles
with photo, specialty, institution, prior interaction history, and a suggested opener;
approved talking points; logistics with a site map; staffing roles; contact cards with
photos and numbers for the truck operator, the site coordinator, and the representative;
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

---

## 5. Technical architecture

**Stack**

- Next.js 15 (App Router), TypeScript in strict mode
- Tailwind, shadcn/ui
- Dexie (IndexedDB) for local-first persistence
- WebCrypto envelope encryption at rest, key derived from a passphrase
- SheetJS for client-side spreadsheet parsing
- React-PDF or Puppeteer for the briefing PDF
- Anthropic API via a route handler; key server-side only
- Vitest for unit tests, Playwright for end-to-end, custom harness for evals
- Vercel deployment, GitHub Actions for CI

**Non-negotiables**

1. No server-side database of HCP data in v1. Local-first is a security posture, not
   just a convenience.
2. The API route is a stateless pass-through. It logs metadata, never content.
3. No third-party analytics. None. A tool handling physician data does not phone home
   to a marketing SDK.
4. Content Security Policy, Subresource Integrity, strict headers. Table stakes, but a
   reviewer will check.
5. PWA with a service worker so capture works offline in a parking lot with no signal.

**Data model**

`Event` → `Attendee` → `Note` → `Draft` → `AuditRecord`
plus `VoiceProfile`, `ApprovedContent`, `Settings`

Every record carries `createdAt`, `updatedAt`, and a schema version for migrations.

---

## 6. Phases

**Phase 0 — foundation (this weekend).** Repo, CI, doc skeleton, ADR-0001 recording
the public/private split. Nothing works yet; the scaffolding is visible.

**Phase 1 — parity, done properly (week 1–2).** Capture, persistence with crash
recovery, roster import, drafting server-side, pseudonymization boundary, review gate,
audit log, and the first eval cases. Compliance lands with the feature, never after.

**Phase 2 — planning A (week 3).** Approved content library, attendee profiles, the
briefing PDF.

**Phase 3 — planning B (week 4).** Pre-event email, map links, `.ics` generation,
site map upload, Design A invite behind its flag.

**Phase 4 — hardening (week 5).** Eval suite to full coverage, threat model, DPIA,
compliance map, published results, demo video.

Five weeks of evenings. Phase 1 alone is a defensible portfolio piece; don't let
Phases 2–4 hold up shipping something real.

---

## 7. What I need from you

§1 and §3.4 are settled — ADR-0001 and ADR-0002 are drafted and ready to commit. What
remains:

1. **8–15 more of the representative's emails**, with range: an enthusiastic recipient, a lukewarm
   one, a department chair, a staff coordinator, and one where she's asking for
   something. Range matters more than volume. Placeholder the names.
2. **Status on §2** — has the representative raised this with her manager, or is that still ahead?
   Doesn't block the public build, gates the private one.
3. **What "approved content" she actually has** — a leave-behind, an approved slide,
   a fact sheet. It determines whether §4.2 is a library-selection feature or just a
   text field she pastes into.
4. **Your GitHub handle**, and confirmation the repo is public from the first commit.

---

## 8. Open questions worth your judgment

- Does the representative ever need to hand the tool to a colleague? Multi-user changes the auth
  and data-residency picture substantially. Assume no for v1.
- Do you want the audit log exportable to a format her compliance team could actually
  ingest, or is CSV enough? Building for the former is a nice flourish.
- How much do you want to invest in the voice profile versus letting her edit? There's
  a real ceiling on style matching, and past a point her editing pass is faster than
  another round of prompt work.
