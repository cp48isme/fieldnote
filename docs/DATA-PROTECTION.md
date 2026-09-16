# Data protection assessment

Written 2026-09-16, session 16, against `main` at `5d669b0`. Plan §4.6's row for this
document is "DPIA-style assessment, data inventory, retention, minimization", and the
build guide's entry adds that retention is decided before the session rather than during
it. It was: the owner's decision of 2026-09-16 is in `fieldnote-tcq`'s notes, and §4
writes it up as decided and not yet built.

**How to read it.** This assesses the public build as a design: the design the private
fork will run with real data. The public build itself holds synthetic data (ADR-0001), so
every sentence here about a real data subject is a sentence about the private fork, and
says so. The document is precise rather than expansive (plan §4.6). It does not claim a
legal basis, a jurisdiction, a lawful-processing ground, a special category, or a risk
tier; `docs/COMPLIANCE-MAP.md` (session 17) does that work against named frameworks, and
this document hands it the facts. Where a sentence would need a lawyer to be true, the
fact the lawyer would need is written instead. Every control named here points at the
file that enforces it or says *not enforced; documented*, as `docs/THREAT-MODEL.md`
does. That document's §6 is the residual-risk list this one cites and does not restate;
its §2 is the flow this one draws in more detail; `docs/ARCHITECTURE.md` (session 18)
owns the drawn diagrams.

**What this document does not assess.** The private fork's deployment. Nothing is
deployed (`fieldnote-ijg`), the private fork has no session (`fieldnote-v2s`), and
hosting would add at least one processor this document does not know (§7). Plan §2's
organisational review is a precondition of any deployment with real data, and this
document does not stand in for it.

---

## 1. Purpose and scope

The system captures what a field representative learns from attendees at demonstration
events for regulated products, typed or dictated on her phone, and drafts the
personalised follow-up correspondence she sends afterwards, for her review before
anything leaves the device. Beside that it lays out the internal briefing she writes
before an event and composes the pre-event email to registered attendees from what she
enters. It never sends anything: every export is her own action into her own
applications (`CLAUDE.md`; ADR-0009; ADR-0011).

**The data subjects.** Four kinds of person have data in the store, and the inventory
in §2 says which fields describe whom.

- **Attendees who are healthcare professionals** — the `[HCP_n]` class of plan §4.1.
  Name, role, specialty, institution, whether they were met or listed, a photograph if
  she took one, her briefing notes about them, the notes she captured about what they
  said, and the drafts addressed to them. In the private fork these are real clinicians
  who did not ask to be recorded, which is the exposure ADR-0001 sets out.
- **Attendees who are staff** — the `[STAFF_n]` class, with the same fields.
- **Contacts** — the representative's own team, the site coordinator, the truck
  operator, transportation. Name, function, phone, email, notes. They exist for the
  briefing and nothing else: no follow-up is drafted to them and no token is issued for
  them.
- **The representative herself.** Her notes are hers; the voice profile is drawn from
  her own correspondence; and the audit trail records when she opened and exported each
  draft and by how much she changed it. She is the only user, and the only person who
  reads the store.

**What the public build holds.** Synthetic data, obviously so, and an empty approved
content library. No real name of any person or institution is in the repository or its
history, enforced by the denylist in the pre-commit hook and in CI with the limits
`docs/THREAT-MODEL.md` §3.4 states.

---

## 2. Data inventory

Derived from `src/lib/db/schema.ts` at schema version 9: the eleven tables in `TABLES`,
every field, its encryption classification, and the schema's own `why`, quoted. Nothing
is re-classified here.

The classification's meaning, from ADR-0004: *eligible* means encrypted at rest once
session 19 replaces the identity cipher, in the private fork; *clear* means stored as
is, because the field must be indexable or carries no identity. Today the cipher is an
identity pass-through in both builds, so the column records a decision made at
schema-definition time, not a present property of the store. `pnpm typecheck` refuses an
unclassified field, because `FieldPolicies<T>` is a mapped type over `Required<T>`; and
`tests/unit/schema.test.ts` asserts that every table has a policy set, every field a
reason, the base fields clear on every table, and no eligible field indexed.

Every record carries four base fields, classified once and spread into each table below.

| Field | Class | Why (schema) |
|---|---|---|
| `id` | clear | Opaque UUID; primary key, must be indexable. |
| `createdAt` | clear | Timestamp; carries no identity. |
| `updatedAt` | clear | Timestamp; carries no identity. |
| `schemaVersion` | clear | Migration machinery must read this without a key. |

### `events` — 17 fields: the four above and these thirteen

Written by the representative on the capture, pre-event, and briefing screens. About the
event and its site. In the private fork the name, the site, the address, and the
coordinates describe a real institution on a real date, which is the schema's reason for
the eligible column.

| Field | Class | Why (schema) |
|---|---|---|
| `name` | eligible | Judgement call: an event name in the private fork routinely contains an institution or a town, which identifies indirectly. |
| `siteLabel` | eligible | Location of a real site; identifying in combination with the date. |
| `startsAt` | clear | Timestamp; needed for sorting events. |
| `endsAt` | clear | Timestamp, like startsAt; carries no identity. |
| `status` | clear | Enum state; drives queries, no identity. |
| `objectives` | eligible | Free text about a real account's event; names what the visit is for. |
| `configuration` | eligible | Free text; the room, the equipment, the site — identifying in combination. |
| `itinerary` | eligible | Free text; times and places at a real site on a real date. |
| `logistics` | eligible | Free text; addresses, parking, access — a location record. |
| `contingency` | eligible | Free text; may name people to call and where to go. |
| `address` | eligible | A real site's street address; identifying in combination with the date. |
| `coordinates` | eligible | A location to a few metres, kept as one string so the seam's shapes stay two. |
| `forwardableEnabled` | clear | A flag; no identity. Whether an event's email carries the block is not about anyone. |

### `attendees` — 12 fields: the four base fields and these eight

One record per person at an event, written by the dock's add-person flow (`captured`)
or by a confirmed roster import (`imported`), and edited in the attendee view. This is
the table that holds attendee identity, and `displayName` is the string the
pseudonymizer replaces before any model call.

| Field | Class | Why (schema) |
|---|---|---|
| `eventId` | clear | Foreign key; must be indexable. |
| `displayName` | eligible | Directly identifying. |
| `kind` | clear | Enum; the token class the pseudonymizer issues. No identity in it, like source. |
| `role` | eligible | Judgement call: a role is not identifying alone, but is identifying alongside institution in a small department. |
| `specialty` | eligible | Same reasoning as role; a specialty plus an institution narrows sharply. |
| `institution` | eligible | Directly identifying in combination. |
| `source` | clear | Enum; records how the record arrived, met or listed. No identity in it. |
| `briefingNotes` | eligible | Free text about a named person, written for an internal document. |

### `notes` — 8 fields: the four base fields and these four

What she typed or dictated about an interaction. `attendeeId` is null until the note is
attributed, and may stay null. The `source` enum exists to record how text arrived; the
one caller of `createNote` passes no source, so every note is written as `typed` today,
because the application cannot tell dictated text from typed text (ADR-0005).

| Field | Class | Why (schema) |
|---|---|---|
| `eventId` | clear | Foreign key; must be indexable. |
| `attendeeId` | clear | Opaque foreign key; must be indexable. |
| `body` | eligible | Free text about a real interaction; the most sensitive field in the store. |
| `source` | clear | Enum; records how text arrived, never any audio (ADR-0005). |

### `drafts` — 14 fields: the four base fields and these ten

Correspondence addressed to one attendee: a follow-up the model drafted, or a pre-event
email composed with no model (ADR-0011). Written only beside its audit record, in one
transaction (`createDraftWithAudit`; ADR-0008). `body` is what she edits and exports;
`generatedBody` is the text as it was written, kept so the edit distance on the record
can be computed against something the record itself does not hold.

| Field | Class | Why (schema) |
|---|---|---|
| `eventId` | clear | Foreign key; must be indexable. |
| `attendeeId` | clear | Opaque foreign key; must be indexable. |
| `kind` | clear | Enum; what the draft is. The review surface labels it. |
| `body` | eligible | Correspondence addressed to an identified person, post-rehydration. |
| `generatedBody` | eligible | The same correspondence before editing; identical sensitivity to body. |
| `state` | clear | Enum; the review gate queries on it, so it must be readable without a key. |
| `blocked` | clear | Enum reason; carries no content and no identity. |
| `flagsFired` | clear | Guardrail rule ids; no identity. Not a string, so could not be eligible. |
| `promptTemplateVersion` | clear | Version string; no identity. Null when no prompt ran (ADR-0011). |
| `guardrailRulesetVersion` | clear | Version string; no identity. |

### `auditRecords` — 19 fields: the four base fields and these fifteen

One per draft, written with it, never deleted (ADR-0008), touched twice afterwards by the
two review-gate transitions. Nothing on it is content and nothing is eligible, by design:
the schema's reason is that an audit log an auditor cannot read without the data-owner's
passphrase is a worse audit log. What the two hashes are taken over, and what they can be
matched against, is in §6.

| Field | Class | Why (schema) |
|---|---|---|
| `draftId` | clear | Foreign key; must be indexable. |
| `eventId` | clear | Foreign key; must be indexable. May point at a deleted event (ADR-0008). |
| `model` | clear | Model identifier; no identity. Null means composed with no model (ADR-0011): a pre-event email is a draft under the gate, and the record says honestly that nothing generated it. |
| `promptTemplateVersion` | clear | Version string; no identity. Null when no prompt ran, the same case as a null model. |
| `guardrailRulesetVersion` | clear | Version string; no identity. |
| `inputHash` | clear | Hash, not content. That is the point of it. |
| `outputHash` | clear | Hash, not content. |
| `flagsFired` | clear | Guardrail rule ids; no identity. |
| `blocked` | clear | Enum reason; no content. |
| `reviewedAt` | clear | Timestamp; the review-gate signal. |
| `exportedAt` | clear | Timestamp; the review-gate signal. |
| `humanEdited` | clear | Boolean; the review-gate signal. |
| `editDistance` | clear | Integer distance, not content. Plan §4.4 surfaces it as a dashboard metric. |
| `passagesUsed` | clear | Opaque ids of approved copy; no identity. |
| `libraryVersion` | clear | Hash, not content. |

### `voiceProfiles` — 7 fields: the four base fields and these three

The representative's own writing, as guidance and samples. Nothing outside the data
layer reads this table today: no module under `src/` outside `src/lib/db/` references
it, the prompt template takes no voice input, and the route's request schema has no
field for one. The table exists for a later session; nothing sends it.

| Field | Class | Why (schema) |
|---|---|---|
| `label` | clear | User-chosen label for the profile; no identity. |
| `guidance` | eligible | Judgement call: style guidance is not identity, but is drawn from real correspondence and may quote it. |
| `sampleText` | eligible | Real prior correspondence; may name people even after review. |

### `approvedContent` — 7 fields: the four base fields and these three

The library claim-bearing text is selected from (plan §4.2). Empty in the public build;
the private fork loads the real passages. All three fields are clear, and
`fieldnote-ao9` records the classification to revisit at session 19: approved copy holds
no personal data, but in the private fork the set of it — label, body, and source
reference together — is a fingerprint of the manufacturer and product line, which is
what ADR-0001 exists to keep off disk. Not re-classified here.

| Field | Class | Why (schema) |
|---|---|---|
| `label` | clear | Library label; no identity. |
| `body` | clear | Approved promotional copy. Already cleared for external use by definition, so it holds no personal data; keeping it clear lets the claim matcher (session 9) read it without a key. |
| `sourceRef` | clear | Reference to the approving document. |

### `settings` — 6 fields: the four base fields and these two

One row. Which event is active, and the autosave debounce.

| Field | Class | Why (schema) |
|---|---|---|
| `activeEventId` | clear | Opaque foreign key. |
| `autosaveDebounceMs` | clear | Configuration integer. |

### `sessionMarkers` — 8 fields: the four base fields and these four

Crash-recovery bookkeeping, not a domain entity. A marker with no `endedAt` is a session
that never shut down cleanly; `touchedNoteIds` lets recovery say which notes were in
flight. Holds ids and timestamps and no user data.

| Field | Class | Why (schema) |
|---|---|---|
| `startedAt` | clear | Timestamp. |
| `lastSeenAt` | clear | Timestamp; heartbeat. |
| `endedAt` | clear | Timestamp or null. Recovery must read this before any key exists. |
| `touchedNoteIds` | clear | Opaque foreign keys. |

### `images` — 10 fields: the four base fields and these six

An attendee's photograph, or the event's site map. The facts, stated without
characterising them under any law: a photograph is an identifiable image of a person,
uploaded by the representative from her own camera or files and never fetched; it is
resized on the device before it is stored — longest edge 512 pixels, JPEG — and a site
map to a longest edge of 1600 pixels, PNG, because a map's text is unreadable smaller
(`src/lib/images/resize.ts`); neither is upscaled; the result is stored as bytes with
its media type and pixel size, never as a `Blob` (ADR-0004 as amended 2026-09-15). The
only processing is decode, fit, draw, encode (`resizeImage`): nothing reads what the
image shows, and no recognition of any kind is performed or depended on. One image per
owner and purpose; a re-upload replaces the bytes under the same id (`putImage`).

| Field | Class | Why (schema) |
|---|---|---|
| `ownerId` | clear | Foreign key; must be indexable. |
| `purpose` | clear | Enum; what the image is for. No identity in it. |
| `bytes` | eligible, shape `bytes` | A photograph of a named person: directly identifying, and the only binary in the store. |
| `mediaType` | clear | A media type is not identity; the layout needs it before decoding anything. |
| `width` | clear | Pixel dimension; no identity. Sizes the layout without decoding. |
| `height` | clear | Pixel dimension; no identity. Sizes the layout without decoding. |

### `contacts` — 10 fields: the four base fields and these six

People on the briefing who are not attendees. A contact never enters a model call and
the pseudonymizer never sees one: `tests/unit/contacts-boundary.test.ts` fails the build
if anything under `src/lib/generation/` or `src/lib/privacy/` names the table, and the
pipeline's input type has no key for them.

| Field | Class | Why (schema) |
|---|---|---|
| `eventId` | clear | Foreign key; must be indexable. |
| `name` | eligible | Directly identifying. |
| `function` | eligible | A function at a named site narrows to one person; and it is free text she wrote. |
| `phone` | eligible | Directly identifying contact detail. |
| `email` | eligible | Directly identifying contact detail. |
| `notes` | eligible | Free text about a real person. |

---

## 3. Flows

Six, in text, in the style of `docs/THREAT-MODEL.md` §2. Each says what enters, what is
stored, what leaves, and by whose action. There is one network egress in the whole
system, in §3.3; everything else that leaves the device leaves by the representative's
own hand.

### 3.1 Capture, typed and dictated

```
representative ─ typed text ───────────────────────┐
representative ─ speech ─► the OS keyboard's       │
   dictation (where it runs: unrecorded) ─ text ───┴─► textarea ─► data layer ─► IndexedDB:
                                                                    events, attendees,
                                                                    notes, contacts,
                                                                    images
                                                     nothing leaves the device
```

**Enters:** text in a textarea, from her keyboard or from the operating system's
dictation, which the application cannot tell apart (ADR-0005); an event's name, times,
site, address, and coordinates; a person's name in the dock, with the leading title
deciding the token class; the dossier fields, the contacts, and her briefing notes on
the briefing and attendee screens; a photograph or a site map, resized on the device
(§2, `images`). The application requests no microphone permission —
`Permissions-Policy: microphone=()` is asserted against a live response at
`tests/e2e/headers.spec.ts:30` — and holds no audio and no recording.

**Stored:** in the tables above, as typed, through the one data-access layer
(`tests/unit/db-boundary.test.ts`). A note is saved as it is typed, on a debounce;
`tests/e2e/offline.spec.ts` shows capture working after a full reload with the network
disabled.

**Leaves:** nothing, at capture. What the platform's dictation does with her speech
before the application receives text is a different question: the platform transcribes,
and where — on the device or off it — is not recorded anywhere in this repository
(`fieldnote-8w6`). This flow says so rather than assuming either.

**By whose action:** hers, typing or dictating.

### 3.2 Roster import

```
a sign-in sheet (.xlsx or .csv), chosen by the representative
   ─► bytes read in the browser ─► format by magic bytes (.xls refused, ADR-0003)
   ─► every cell a cleaned string, capped at 120 characters (sanitize.ts)
   ─► header found, mapping guessed, matches proposed (match.ts)
   ─► she confirms each row: same person, or new
   ─► applyRosterImport, one transaction ─► attendees
   the file itself is not stored; nothing leaves the device
```

**Enters:** a spreadsheet she picks. It is parsed on the device by the library ADR-0003
chose, which cannot write files; a `.xls` is refused by its first bytes before any parser
runs. Each cell leaves the parser as a string with control characters removed,
whitespace collapsed, and a cap of `MAX_CELL_LENGTH` (120) applied
(`src/lib/roster/sanitize.ts:15`, applied at `:29`; asserted at
`tests/unit/roster-csv.test.ts:53`). The matcher proposes which rows are people already
on the event, on three conservative bases, and nothing is written that she has not
confirmed per row.

**Stored:** `attendees` only — name, kind, role, specialty, institution, marked
`imported`. A merge fills empty fields of an existing record and never rewrites a name;
a new row becomes a record (`applyRosterImport`). The file is not stored anywhere, and
the roster never reaches a model: it feeds the pseudonymizer's roster forms and the
greeting, on the device (`docs/THREAT-MODEL.md` §4).

**Leaves:** nothing. `tests/e2e/roster-import.spec.ts:53` records every request during
an import and shows nothing but same-origin assets was fetched.

**By whose action:** hers, twice: choosing the file, and confirming each row.

### 3.3 Generation

```
┌─ the device ────────────────────────────────────────────────────────────────────┐
│ attendees + notes + event.name + library ─► pseudonymize, three passes ─► guard  │
│   ─► request ─► client.ts ──────────────────────────────────────────────────────┼─► /api/generate
│                                                                                 │     validate schema
│   drafts + auditRecords ◄─ greeting from the record ◄─ rehydrate ◄─ ruleset ◄─  │     structural guard
│     (one transaction)                                  ◄─ output guard ◄────────┼─◄  private-term rule
└─────────────────────────────────────────────────────────────────────────────────┘     log metadata
                                                                                        ─► model API
                                                                                        ◄─ text, tokens in place
```

**Enters the pipeline:** the event, its attendees, their notes, and the library — the
four keys of `BatchInput`, and contacts are not among them
(`tests/unit/contacts-boundary.test.ts`). Every note passes three times through
`src/lib/privacy/pseudonymize.ts` — roster forms, any token after a title, any definite
or sentence-initial role reference (ADR-0006, ADR-0007) — and `assertPseudonymized` then
throws if anything name-shaped or role-shaped survived. That guard is not decorative: a
roster-only tokenizer fails it (`tests/unit/pseudonymize.test.ts`), and the pipeline
never lets a name or a role reach the request (`tests/unit/pipeline.test.ts`).

**The request the route validates**, field by field, from the schema in
`src/app/api/generate/route.ts`. What crosses is what `docs/THREAT-MODEL.md` §2 describes
under *The one egress* and what the §3.3 rows model.

| Field | Shape and limit | Pseudonymized | Inside the note delimiter |
|---|---|---|---|
| `notes` | 1 to 50 strings, each 1 to 20,000 characters | yes, three passes | yes: each wrapped by `wrapNote`, a closing tag inside it broken |
| `recipientToken` | one token, `[HCP_n]`, `[STAFF_n]`, `[PERSON_n]`, or `[ROLE_n]` | it is the token | — |
| `recipientKind` | one of `HCP`, `STAFF`, `PERSON`, `ROLE` | a class, not a person | — |
| `priorOpenings` | up to 50 strings, each up to 500 characters: the first sentence of each earlier draft in the batch | yes | no |
| `eventName` | up to 200 characters, as entered | **no** | **no** (`fieldnote-3rl`) |
| `passages` | up to 50 of `{ id ≤ 64 characters, body 1 to 2,000 characters }`, the approved copy by id and body | not applicable: approved copy | **no** (`fieldnote-3rl`) |

The route checks the schema, runs the structural half of the guard over the notes and
the openings (it has no roster, by design), forwards to the model API through the
provider's SDK, applies the private-term rule to the reply where the local list exists,
and logs metadata: status, model, stop reason, refusal category, blocked, attempts,
ceiling, input and output token counts, the counts of notes, openings, and passages,
whether the private-term rule fired, and duration — and at startup, whether the private
list loaded and how many terms, never a term. `tests/unit/generate-route.test.ts` asserts
"logs metadata only: no note text, no draft text, no key". The key is checked for
presence by name and never read into anything that could print it.

**The response:** `text` with tokens in place, `blocked` (`truncated`, `refusal`, or
null), `model`, `promptTemplateVersion`, and `flagsFired` (`src/lib/generation/contract.ts`).

**Back on the device:** the model's text passes the structural guard again and a draft
in which a name-shaped or role-shaped string appears is withheld as `output-blocked`;
then the ruleset, one sentence at a time, leaves the gap marker where a sentence was
blocked; then rehydration puts each token's canonical form back; then the greeting is
composed from the attendee record, on the device, outside the output hash
(`src/lib/generation/greeting.ts`; ADR-0008 as amended). The draft and its audit record
are written in one transaction, and a withheld draft is written with its reason and no
body.

**Stored:** `drafts` and `auditRecords`. The record holds the input hash of the request
body as serialised and the output hash of the guarded text before rehydration (§6),
never either pre-image.

**Leaves:** the request, to the route on this origin and from there to the model
provider. This is the one network egress. `connect-src 'self'` is asserted against a
live response in `tests/e2e/headers.spec.ts`; `tests/unit/single-egress.test.ts` finds
one network call site in `src/`; `tests/unit/model-call.test.ts` finds one
`messages.create`. What the provider does with the request once received is §7.

**What does not cross:** any name or role (tokens cross instead); contacts; the roster;
photographs and site maps; briefing notes; the dossier fields other than the event
name; the address and coordinates; the voice profile; the audit trail; anything about a
recipient other than their token, their class, and the notes about them.

**By whose action:** hers. Drafting starts when she asks for the batch on the review
screen (`onDraft` in `src/components/capture/CaptureScreen.tsx`, which calls
`generateDrafts`); nothing generates on a schedule or on save. Generation does not work
offline; capture does.

### 3.4 The hand exports

Five things leave the device by hand. None is a network egress: the clipboard is the
system clipboard, and every file goes to her own filesystem through
`src/lib/download.ts`, an object URL on an anchor, clicked and revoked. Each is her own
action into her own applications, and what she does with it afterwards is outside the
system (ADR-0009).

```
review gate ─► clipboard ─► her mail client          (follow-up and pre-event drafts)
briefing screen ─► PDF ─► download                   (ADR-0009)
pre-event screen ─► .ics ─► download                 (session 13)
pre-event screen ─► site map ─► download             (session 12)
review screen ─► audit CSV ─► download               (plan §4.4)
```

| Export | What it carries | Gate | Shown to make no request |
|---|---|---|---|
| **Clipboard** — a follow-up or pre-event draft | The draft body as edited, addressed to one attendee by name, with the approved passages she selected. | Export is unreachable from `generated` and nothing leaves `blocked` (`tests/unit/draft-state.test.ts`); the clipboard write comes first and the record is written only once the text is there (`onExport`, `CaptureScreen.tsx`). | — |
| **Briefing PDF** | The dossier fields, the location, the site map, contacts as cards, each attendee with photo, record fields, and her briefing notes, the contingency plan last. Not the dictated notes: `BriefingInput` has no key for them (`tests/unit/briefing-compose.test.ts`). | None: nothing in it is machine-written (ADR-0009). The page states its attendee section is expected attendance as of the generation date. | `tests/e2e/briefing.spec.ts:37`. |
| **Calendar file** (`.ics`) | One `VEVENT`: a `UID` at a reserved `.invalid` suffix, both times in UTC, the event name as `SUMMARY`, the address as `LOCATION`, `GEO`, and a `DESCRIPTION` holding the address and the two map links and nothing else. No `ATTENDEE`, no `ORGANIZER`, no free text (`src/lib/calendar/ics.ts`). | Disabled until the event has both ends. | `tests/unit/ics.test.ts`, line by line. No calendar application has opened one. |
| **Site map** | The stored bytes, at the stored media type. | None. | With the pre-event screen's run, `tests/e2e/pre-event.spec.ts:57`. |
| **Audit CSV** | Every audit record on the device, eighteen columns: ids, the orphan column, timestamps, model, versions, blocked reason, rule ids, the two hashes, the review-gate fields, passage ids, library hash (`src/lib/review/audit-csv.ts`). No content, no name, no event name. | None. **Nothing records that an export has been taken** (`onExportAuditLog` writes no record). | — |

The pre-event email is composed with no model from the event's location and logistics,
the passages she selected, and a greeting from the record; it is a draft under the same
gate with an audit record whose model is null (ADR-0011), so it reaches the clipboard the
same way a follow-up does. When the event's flag is on it ends with the forwardable
block, composed from fields the email already carries and nothing else (ADR-0002).

### 3.5 Deletion

```
deleteEvent(id), one transaction:
   images owned by each attendee ─► gone        attendees ─► gone
   images owned by the event (site map) ─► gone  notes ─► gone
   drafts ─► gone                                contacts ─► gone
   the event ─► gone
   auditRecords ─► KEPT, eventId now pointing at nothing (ADR-0008)

deleteAttendee(id), one transaction:
   the attendee's images ─► gone                 the attendee ─► gone
   notes ─► KEPT, attendeeId pointing at nothing
   drafts ─► KEPT, attendeeId pointing at nothing
```

**What `deleteEvent` cascades to**, from `src/lib/db/repository.ts`: five tables —
attendees, notes, drafts, contacts, and images, both each attendee's and the event's own
— and then the event, inside one transaction. **What it spares:** audit records, on
purpose (ADR-0008). Two things to state about the record of that cascade rather than
discover later: ADR-0008's decision statement, and the header of `repository.ts`, name
three tables where the code cascades five (`fieldnote-5ow`); and the test at
`tests/unit/repository-drafts.test.ts:230` asserts that the draft is gone and the record
survives with the event's id, and does not assert that attendees, notes, contacts, or
images are gone (`fieldnote-52s`). The cascade is what the code does; the test proves
the two tables it names.

**What `deleteAttendee` takes:** the attendee record and their images. **What it
leaves:** their notes and drafts, which keep an `attendeeId` that now points at nothing
(`fieldnote-jqk`, an open owner decision). The attendee view's confirmation says exactly
that before she confirms — "Their photo and your briefing notes for them are removed.
Notes captured about them and any drafts stay, attributed to nobody; audit records are
not changed." — and `tests/e2e/attendee-view.spec.ts:138` shows the note kept.

**Smaller removals:** a photograph or a site map on its own (`removeImage`); a contact
(`removeContact`); a passage from the library (`removeApprovedContent`), which stays
referenced by id in any audit record that used it (ADR-0008 as amended 2026-09-14). **No
action deletes a single note or a single draft** (`fieldnote-cdx`): a note body can be
edited to empty, a draft body until it is exported, and the event's deletion takes both.

**By whose action:** hers, in each case after a confirmation. Nothing deletes on a
schedule or by age (§4).

### 3.6 The platform's copies

The store is IndexedDB in the browser profile of an installed web app, on her phone.
Three copies of it the application does not make and cannot see:

- **A device or cloud backup.** Whether the installed app's storage is included in a
  device backup or a cloud backup on the target platform, and what a restore does with
  it, is not recorded anywhere in this repository (`fieldnote-ap1`). ADR-0004's threat
  table has the row; nobody has checked it against the platform. This flow says so.
- **Eviction.** The platform may delete the store on its own schedule, before retention
  would (§4; `fieldnote-bdw`).
- **The clipboard, and downloaded files.** Once a draft is on the clipboard or a file is
  in her filesystem, it is outside the system and subject to whatever her mail client,
  her files, and her backups do with it (ADR-0009; `fieldnote-bn0`).

And one input the platform processes before the application sees it: dictation
(`fieldnote-8w6`, §3.1).

---

## 4. Retention

**Decided, 2026-09-16, by the owner.** The decision is in `fieldnote-tcq`'s notes and is
written here as decided, not reinterpreted.

- **Scope:** an event's content — attendees, notes, drafts, contacts, images, and the
  event itself: what `deleteEvent` cascades to today (§3.5).
- **Due:** "30 days after the event ends." The clock keys on `endsAt`; if that is null,
  `startsAt`; if both are null, the event's `updatedAt`.
- **Prompted, with a ceiling:** when an event is due, the application asks the
  representative to delete it and offers the audit CSV and the briefing exports first.
  If she has not acted, it "warns again 7 days before the ceiling, and deletes the event
  at 60 days after the event ends."
- **Audit records:** kept; never pruned by the application. They hold hashes and
  metadata, not content, and pruning them would reopen what ADR-0008 rejected. The
  store's growth in audit records is accepted and stated.
- **Periods:** build-time constants, not a user setting. The private fork may set its
  own values to match an employer's schedule or a legal hold.

**Not yet implemented.** `fieldnote-iox` carries the implementation, in its own session,
with the ADR the decision still needs. Nothing in `src/` deletes by age or on a schedule
today: the only timer in the source is the crash-recovery heartbeat
(`src/lib/db/recovery.ts:83`), and the only deletions are the ones §3.5 lists, each by
her hand. Until `fieldnote-iox` closes, the store is not bounded, and ADR-0004's reliance
on a small local store — "a device holding two events' worth of notes is a smaller loss
than one holding two years'" — is a decided policy, not a present property of the
application. This document does not assume the store is small today, or that anything
deletes on a schedule today.

**Audit records grow without limit by decision** (ADR-0008; `fieldnote-tcq`). They are
small — ids, hashes, timestamps, short strings — and they are all that remains of an
event after it is deleted, which is why they survive. The retention decision keeps them,
and says so.

**Retention and eviction are different questions.** Retention deletes on a schedule the
project chooses; eviction deletes on the platform's, and can only fire sooner, never
later. Which fires first bears on whether data leaves the device before it is lost —
the export prompt at the due point, and ADR-0004's owed availability amendment — and
not on how long data should be kept; that is why the retention decision stopped waiting
on `fieldnote-bdw` and why that bead stays open. What that bead now holds: one device
observation, 2026-09-16, by the owner — the installed app not opened for eight idle
days, iOS 26.6.1, all notes present on reopening; one device, one run — and two things
unobserved: behaviour under storage pressure, and what `navigator.storage.persisted()`
reports. The application does not request persistent storage today (no reference to
`navigator.storage` in `src/`). `docs/THREAT-MODEL.md` §6 still says eviction is
unverified, and this document does not amend it; it records the later observation with
its limits and cites the bead. This document does not assume that eviction protects the
data or that it threatens it.

**Nothing records that an audit CSV export has been taken** (§3.4), so when the retention
prompt offers the exports, the application will not know whether one was ever made. This
document does not assume an export has ever been taken from a real device.

---

## 5. Minimisation

Each decision, its record, and the file that enforces it — or the words *not enforced;
documented*. Each was verified against the file before it was written here.

- **Identity does not cross the egress.** Names, in every form, and roles are replaced
  with stable tokens on the device before the call, with a fail-closed guard, and
  rehydrated locally after. ADR-0006, ADR-0007. Enforced by
  `tests/unit/pseudonymize.test.ts` ("is not decorative: a roster-only tokenizer fails
  it"; "the guard sees roles: a role-only tokenizer is not enough") and
  `tests/unit/pipeline.test.ts` ("never lets a name or a role reach the request"), and at
  runtime by `assertPseudonymized` on the client and its structural half on the route.
  Residual: a name with neither a title nor a roster entry, and a role outside the
  head-noun list or written mid-sentence without a determiner (ADR-0006, ADR-0007,
  *Residual risk*).
- **No audio, no transcription service, no microphone permission.** The platform
  dictates; the application receives text. ADR-0005. Enforced by
  `tests/e2e/headers.spec.ts:30` (`microphone=()` asserted against a live response) and
  `tests/unit/single-egress.test.ts` (no second network destination in `src/`).
- **Contacts never reach the generation layer.** Enforced by
  `tests/unit/contacts-boundary.test.ts`: no reference to the table under
  `src/lib/generation/` or `src/lib/privacy/`, and no key for them on the pipeline's
  input type.
- **The audit record holds hashes and metadata, never content.** ADR-0008. Enforced by
  the schema — nothing on `AuditRecordRecord` is eligible, and `tests/unit/schema.test.ts`
  walks the policies — and by `src/lib/review/audit-csv.ts`'s eighteen columns, which
  are ids, hashes, timestamps, versions, rule ids, and the review-gate fields. The CSV
  test at `tests/unit/audit-csv.test.ts:45` asserts column values and the row length; it
  does not search the row for anything that names anyone, so the second half of its name
  is not an assertion (`fieldnote-tg4`).
- **The route logs metadata only.** Enforced by `tests/unit/generate-route.test.ts`
  ("logs metadata only: no note text, no draft text, no key"; "blocks a refusal and logs
  the category, never the text"; "maps an API error to a 502 without echoing the upstream
  message").
- **Roster cells are cleaned and cut to 120 characters.** `MAX_CELL_LENGTH` at
  `src/lib/roster/sanitize.ts:15`, applied at `:29`. Enforced by
  `tests/unit/roster-csv.test.ts:53`.
- **Photographs are resized on the device.** `src/lib/images/resize.ts`; enforced by
  `tests/unit/resize.test.ts` over a fake surface and `tests/e2e/attendee-view.spec.ts:79`
  through a real canvas. A size decision, not a minimisation of what a photograph is: the
  stored image is still an identifiable image of a person (§2, `images`).
- **No server-side store.** By construction: `tests/unit/db-boundary.test.ts` (Dexie only
  in the data layer) and `tests/unit/single-egress.test.ts` (one destination), and
  `SECURITY.md`'s statement that the application holds no server-side user data. No test
  asserts the absence of a store; the two tests bound where data can go, and the route is
  a stateless pass-through read against `src/app/api/generate/route.ts`.

**What is not minimised, as plainly:**

- **The event name and the approved passages** cross the boundary as entered, outside
  the note delimiter, and the event name is not pseudonymized (`fieldnote-3rl`). In the
  private fork an event name routinely contains an institution or a town (§2, `events`).
  Wrapping both is a prompt-template change for a later session.
- **What the provider retains** of the pseudonymized request is an account arrangement,
  not a code property, and nobody has verified it (`fieldnote-n9l`; §7).
- **Audit records grow without limit**, by decision (§4).

---

## 6. Rights and their limits

What the design can do today, stated plainly, as facts about the private fork's data
subjects. Any request from a data subject reaches the system through the representative,
its only user: nothing in the application tells an attendee that a record exists, and
no one but her can read or change the store.

**Access and correction.** She can read everything the device holds about a person on
the attendee view, which assembles it from what she typed, dictated, or generated
(`src/lib/attendees/history.ts`). She can correct an attendee's name, class, role,
specialty, and institution there (`AttendeeEdit`, the five fields the view edits); edit
a note's body; and edit a draft's body until it is exported, after which it is
read-only. `source` and `eventId` are history and are not editable.

**Deleting an event** removes that event's attendees, notes, drafts, contacts, and images
— the five tables `deleteEvent` in `src/lib/db/repository.ts` cascades to — inside one
transaction. What the test proves: `tests/unit/repository-drafts.test.ts:230` asserts
that the draft is gone and that the audit record survives with the event's id; it does
not assert the other four tables (`fieldnote-52s`). ADR-0008's decision statement names
three tables where the code cascades five (`fieldnote-5ow`). The cascade is read from the
code; the proof covers drafts and records.

**A request concerning one attendee cannot be fully met without deleting the whole
event.** Removing the attendee takes their record and their images and leaves their notes
and drafts in the store, attributed to nobody (`deleteAttendee`; `fieldnote-jqk`, an open
owner decision). The confirmation she sees says so (§3.5).

**A request concerning one note or one draft cannot be met without deleting the whole
event either.** No action deletes a single note or a single draft (`fieldnote-cdx`, an
open owner decision). A note can be edited to empty, which leaves the record.

**Audit records are not deleted by any action** (ADR-0008). They hold hashes and
metadata: ids, timestamps, the model and versions, rule ids, blocked reason, passage ids,
and the review-gate fields. A deletion request is met for content — the notes, the
drafts, the attendee record, the images — and is stated plainly as not met for the
hash-only record, which survives with an `eventId` that resolves to nothing.

**What a hash of pseudonymized text can and cannot be matched against.** Stated as fact,
not characterised; session 17 does the characterising.

- `inputHash` is SHA-256 over the request body exactly as the client serialised it: the
  pseudonymized notes, the recipient's token and class, the prior openings, and the event
  name as entered (ADR-0008, *What is hashed*). The pre-image is not stored. It can be
  reproduced only by someone holding the notes and the roster as they were at generation,
  on a device that runs the same tokenizer; it names nobody, and the event name is inside
  it as entered.
- `outputHash` is SHA-256 over the model's text after the ruleset and before
  rehydration, still name-free, below the greeting. The pre-image is not stored. For an
  unblocked draft it can be reproduced on the device that holds the draft by
  re-pseudonymizing `generatedBody` below the greeting line (ADR-0008); after the draft
  is deleted, nothing on the device reproduces it.
- Neither hash can be reversed to its text. Either can be matched against a candidate
  text only by someone who already holds that exact text. Neither reconstructs against
  anything that contains a name. Both hashes on a surviving record tie a generation, at a
  time, under a model and two versions, to an event id, and to a draft id whose draft is
  gone.

**The exports.** Once a draft is on the clipboard or a file is downloaded, the copy is
outside the system (§3.4). Deleting the event does not reach it. This document does not
assume any export has been taken from a real device, and nothing records that the audit
CSV has been.

---

## 7. Processors and third parties

**In the public build, one: the model provider.** The route forwards to the Anthropic
API through the provider's SDK (`SECURITY.md`; `src/app/api/generate/route.ts`), and the
model identifier is on every audit record.

- **What it receives:** the request in §3.3's table — pseudonymized notes for one
  recipient, the recipient's token and class, pseudonymized prior openings, the event
  name as entered, and the approved passages by id and body — as `docs/THREAT-MODEL.md`
  §2 describes under *The one egress* and the §3.3 rows model.
- **What it does not receive:** identity. No name, no role, no contact, no roster, no
  photograph, no briefing note, no address or coordinates, no voice profile, and nothing
  about a recipient beyond their token, their class, and the notes about them. Enforced
  as §5's first three items say.
- **What is not verified:** what the provider retains of what it receives. Plan §4.1
  pairs the boundary with zero-retention configuration on the API; that is an account
  arrangement, nothing in the repository verifies it, and no document records that it is
  in place or how it was confirmed (`fieldnote-n9l`). Session 17's compliance map depends
  on the answer.
- **A second path to the same provider, from the repository and not the device:** the
  adversarial eval suite calls the live model from CI on a change under a watched path,
  with the synthetic corpus, and keeps a results artifact holding pseudonymized samples
  only (`.github/workflows/evals.yml`; `docs/THREAT-MODEL.md` §3.4). No real data subject
  is in it.

**The platform, as unverified.** The operating system's dictation processes her speech
before the application receives text, and where that happens is not recorded
(`fieldnote-8w6`). Whether the installed app's storage is included in a device or cloud
backup is not recorded (`fieldnote-ap1`). Both are named here as unverified rather than
assumed either way.

**Hosting the private fork would add at least one more.** The route holds the key and
runs on the same origin as the page; serving it from any hosted origin adds the host as a
party and needs the controls `fieldnote-9n1` lists, which the route does not have.
Nothing is deployed (`fieldnote-ijg`), and this document does not assess a deployment.

**No analytics, telemetry, error reporting, or CDN.** Plan §5's third non-negotiable.
The controls, as the threat model's cells name them: `connect-src 'self'` and
`Referrer-Policy: no-referrer` asserted against a live response, a content security
policy with a per-request nonce and `'strict-dynamic'`, nothing precached from a
third-party origin, one network call site in source (`docs/THREAT-MODEL.md` §3.2, the
information-disclosure row; §3.3, the spoofing row). Enforced by
`tests/e2e/headers.spec.ts`, `tests/e2e/offline.spec.ts` ("precaches nothing from a
third-party origin"), and `tests/unit/single-egress.test.ts`, with the limit §6 of the
threat model states: the source check is a grep, and the browser's enforcement of
`connect-src` is the runtime check behind it.

**The repository host** holds the source, the CI logs, and the eval artifact, none
of which is attendee data. The private-material item is `docs/THREAT-MODEL.md` §5.5
and the last item of its §6; this document cites it there and does not restate it.

---

## 8. Residual risk

`docs/THREAT-MODEL.md` §6 is the list, and this document cites it by item rather than
restating it. The items there, by their opening words: data at rest in the private fork
protected by full-disk encryption and origin isolation and nothing else; retention
unresolved, with ADR-0004 leaning on it; device auto-lock a precondition the application
does not enforce; subresource integrity partial; the single-egress check a grep; CI
enforcing structural denylist patterns only; the end-to-end suite in one browser; the
service worker's update path untested; Safari's eviction window unverified; the private
fork with no session; audit records growing without bound by design; a name with neither
a title nor a roster entry missed; the event name and the approved passages crossing
outside the note delimiter; the provider's retention an account arrangement; and the
last item, `fieldnote-loh`, as §6 words it. Each has its bead or its decision record
there.

Since that list was written, retention has been decided and not built; the second item
now reads as §4 of this document says, with `fieldnote-tcq` closed and `fieldnote-iox`
open.

Added here, each with a bead, each specific to data protection, none already in §6:

- **Retention is decided and not implemented.** Until `fieldnote-iox` closes, nothing
  bounds the store, and the export prompt the decision relies on does not exist.
- **Eviction, on the availability axis.** Whether data leaves the device before the
  platform deletes it depends on her exporting it, and nothing in the application
  prompts her to yet. One device observation now exists (§4) and the storage-pressure
  and `persisted()` questions do not. `fieldnote-bdw`; ADR-0004 owes the availability
  amendment when it resolves.
- **A request concerning one attendee cannot be fully met without deleting the event.**
  `fieldnote-jqk`.
- **A request concerning one note or one draft cannot be met without deleting the
  event.** `fieldnote-cdx`.
- **Where the platform's dictation runs is unrecorded.** `fieldnote-8w6`.
- **Whether the store is in a device or cloud backup is unrecorded.** `fieldnote-ap1`.
- **The clipboard holds an exported draft until it is overwritten**, readable by another
  application on the device. `fieldnote-bn0`.
- **The set of approved content is a fingerprint of the manufacturer** in the private
  fork, and all three of its fields are clear. `fieldnote-ao9`, at session 19.
- **The cascade test asserts less than its name**, and the decision record and the
  repository header name three cascaded tables where the code cascades five.
  `fieldnote-52s`, `fieldnote-5ow`.
- **The audit CSV test does not assert the absence of names.** `fieldnote-tg4`.

What the next two documents will need from here, and where it is. `docs/COMPLIANCE-MAP.md`
(session 17) needs the facts it will characterise, and should cite rather than
re-derive them: the data subjects in §1; the inventory in §2, with the classification
column read as ADR-0004's plan and not as encryption in place; what crosses the egress
and what does not in §3.3 and §7; the retention decision in §4 as decided and not built;
the enforced-versus-documented status of each minimisation in §5; the deletion limits and
the hash facts in §6; and `fieldnote-n9l`, on which its data-minimisation mapping
depends. `docs/ARCHITECTURE.md` (session 18) owns the drawn diagrams: the six flows in §3
are its text sources, `docs/THREAT-MODEL.md` §2 is the boundary diagram they sit inside,
and the request table in §3.3 is the one thing every drawing of the egress should carry
exactly.
