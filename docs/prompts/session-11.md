# Session 11 — Briefing PDF

Written from a read-only printout of the repository taken 2026-09-15; checked again at the
start of the session, on `main` at `b0a1c4b` after PR #44. No premise was wrong. What was
decided rather than read is in the how-it-went section at the end.

---

Session 11 — the briefing. On `main` at `b0a1c4b`. One PR, and it will be long: the
guide budgets four hours, and since then it has gained a dependency decision, a cipher
extension, two entities, and a form. Amend the Phase 2 total when you amend the entry.

Read before starting: `CLAUDE.md`; `docs/HANDOFF.md`; plan §3.2 as amended and §5;
ADR-0003, ADR-0004, ADR-0009; `src/lib/db/` in full; `src/components/attendees/
AttendeeView.tsx`; the CSV export in `CaptureScreen.tsx` (the download pattern);
`bd show fieldnote-g7d`, `fieldnote-bdw`.

## Decisions, made

**The PDF is produced by a library, chosen by an ADR.** The owner's decision: a real
download, not the print path — on iOS print-to-PDF reaches the share sheet and produces
a save, and ADR-0009 says download. Write ADR-0010 in ADR-0003's shape: candidates
`jspdf` and `pdf-lib` and the print path; for each, last publish date, maintenance,
dependencies, unpacked size, open advisories (`npm audit` on a scratch install, or the
GitHub advisory API), and what capability it carries the app will not use. The raw
material: `pdf-lib` 1.17.1 last published May 2022 with `tslib` 1.x; `jspdf` 4.2.1
published March 2026, three runtime dependencies, about 30 MB unpacked. Decide, say why,
and install only what the ADR chose. Stop before installing if the choice has an open
advisory.

**Binary storage: bytes, not Blobs, and the cipher learns a second shape.** The
printout's design, adopted:
- `FieldCipher` gains `encryptBytes(ArrayBuffer): ArrayBuffer` and `decryptBytes`; the
  identity cipher passes bytes through.
- `FieldPolicy` gains `shape: "string" | "bytes"`, defaulting to string everywhere it is
  omitted so no existing policy changes. The transform branches on the declared shape
  and throws on a mismatch in either direction — a bytes field holding a string, a
  string field holding bytes — so the control the cipher's comment describes survives.
- Images are stored as `ArrayBuffer` with a sibling `mediaType` string, never as a
  `Blob`: a real cipher emits bytes, and nothing then depends on a Blob surviving
  IndexedDB on Safari.
- A bytes round-trip in `cipher.test.ts` beside the string one, and a test that the
  mismatch throws both ways.
- ADR-0004 gets a dated note saying the seam now carries two shapes and why.

**One `images` table, not a photo field.** `ImageRecord { id, ownerId, purpose:
"attendee-photo" | "site-map", bytes, mediaType, width, height }`. `bytes` eligible
(shape bytes); the rest clear. `purpose` exists now so session 12's site map lands in
the same table without another migration; this session stores only `attendee-photo`,
one per attendee, replaced on re-upload. Deleting an attendee deletes their image;
deleting an event cascades through attendees. ADR-0008's audit records are untouched.

**Photos are resized on the device before storage**: longest edge 512 pixels, JPEG,
via a canvas — no dependency. A phone camera produces 4 MB files and a briefing needs
a thumbnail. The resize is a pure function taking an image and a drawing surface so
it can be unit-tested with a fake surface; the real one is exercised end to end.
Upload lives on the attendee view, session 10's screen, which is where the record is.

**The team is `contacts`, not attendees.** `ContactRecord { id, eventId, name,
function, phone, email, notes }`, all eligible except the keys. This is plan §3.2's
contact cards and staffing roles and `fieldnote-g7d`'s second class of person: her own
team, the site coordinator, the truck operator, transportation. **A contact never
enters a model call and the pseudonymizer never sees one.** Say that in the schema
comment and enforce it: the pipeline takes attendees and nothing else, and a test
asserts `contacts` is not imported anywhere under `src/lib/generation/`.

**The dossier lives on the event.** `EventRecord` gains `objectives`, `configuration`,
`itinerary`, `logistics`, `contingency` — five eligible strings, empty by default. No
new table for what is plainly event data.

**Per-attendee briefing text lives on the attendee.** `AttendeeRecord.briefingNotes`,
eligible string, edited on the attendee view. This is where she types the opener and
the talking points ADR-0009 withdrew from the model. **The dictated notes are not in
the briefing.** They were captured for follow-ups; a document that gets forwarded and
printed does not carry them. The PDF has the record's fields, the photo, and what she
wrote for the briefing. Say so in the briefing screen's copy.

Schema v6 for all of it: migration backfilling empty strings and no rows, policies for
every field, a migration test against the fake database.

## The briefing screen

Reached from the event switcher, the pattern of sessions 8 through 10. One screen,
sections in the order the document will have them:

1. **Event** — name and date from the record, the five dossier fields editable.
2. **Contacts** — add, edit, remove; name, function, phone, email, notes.
3. **Attendees** — the event's attendees listed with photo thumbnail if any, and a link
   to each one's view, where the photo and the briefing notes are edited. A line: the
   list is expected attendance as of today, and people met at the event who are not
   on it will not appear.
4. **Generate** — one button. Builds the PDF from what is stored and downloads it
   through the same object-URL pattern the CSV export uses. No network. No record is
   written: nothing was generated by a model, so ADR-0009 says there is no audit
   record, and there is none.

## The document

Sections per plan §3.2 as amended: dossier; contacts as cards with function, phone,
email; attendees, one per block, with photo, name, role, specialty, institution, and the
briefing notes; the contingency plan; and no talking-points section — those are in the
attendee blocks, written by her. No deal positioning, no field for it.

The page states its own limits: a footer on every page with the event name, the
generation date and time, and "Attendee list is expected attendance as of [date]."
Layout that reads on a phone and prints on A4 and Letter, per the guide's warning that
this is fiddly. Test the builder as a pure function over records: given fixtures, the
document has the expected sections and text, and the output begins with `%PDF`.

## Fixtures

A synthetic photo — a script-generated PNG, a flat colour with the initials of a
synthetic roster name, committed with its generator like the roster fixture. Every
contact and dossier value in tests is invented and passes the denylist.

## Scope guard

No site map upload (session 12); the `images` table's `purpose` has the value, nothing
writes it. No post-event readout; that is a separate decision, still open on
`fieldnote-g7d`. No model, no prompt, no ruleset, no audit record. No change to the
pseudonymizer or the pipeline beyond the contacts-exclusion test. The eval gate should
skip; if it runs, say what tripped it.

## Bookkeeping

ADR-0010 in the index. ADR-0004's dated note. Guide session 11 amended on completion
with what shipped and the Phase 2 total revised; session 12's entry gains one line that
the site map goes in `images` with purpose `site-map`. `fieldnote-g7d` updated: what
session 11 closed, and the post-event readout split out as its own bead. Fix the handoff's
attribution of "no new dependency" — that was a prompt's rule, not `CLAUDE.md`'s; the
project's rule is an ADR for any dependency, which this session follows. Handoff
regenerated; changelog; prompt file with how-it-went.

## Constraints and stop conditions

As every session. Stop if: the chosen library has an open advisory; the cipher's bytes
path cannot be added without weakening the string-mismatch throw; the resize cannot be
factored to unit-test without a canvas; a phone-sized photo cannot round-trip through
IndexedDB in the e2e suite; or a premise here does not match the repository.

## Done when

ADR-0010 chosen and installed. The cipher round-trips bytes and throws on shape
mismatch. Schema v6 migrated and tested. A photo uploaded on the attendee view is
resized, stored as bytes, and shown. Contacts and dossier fields save. Generate
downloads a PDF containing every section, with the expected-attendance footer, and the
e2e spec records no network request during it. `contacts` is unreachable from the
generation layer by test. Unit and e2e green; eval skipped.

## Report back

(1) Verified versus assumed. (2) ADR-0010's choice and the deciding reason. (3) The
cipher change in three lines. (4) What the PDF looks like — sections, pages for the
fixture event, file size. (5) File by file. (6) Beads, ADRs, guide amendments. (7)
Flags — and whether a real phone photo has been through it, which it has not unless
you say so.

## How it actually went, for whoever reuses this

**No premise was wrong.** The printout and the prompt were the same day, and every claim
about the cipher, the schema, the plan, and the two libraries held. The advisory data
gathered for ADR-0010 matched the prompt's raw material and added the part it could not
have known: `jspdf` had ten advisories in 2026, every one patched at the version on the
registry, and none on `pdf-lib` ever.

**ADR-0010 went to `pdf-lib`, and the deciding reason was the smaller thing to trust**
— ADR-0003's reason, applied again. `jspdf` is maintained and clean at 4.2.1, and its
advisory history is a list of capabilities the briefing has no use for: script embedding,
forms, HTML rendering, GIF and BMP decoders. `pdf-lib` is four packages of primitives with
no advisory on record and no facility for any of that. Its age is the cost and the record
says so plainly: last published May 2022, no patch path if one is ever needed. What makes
that acceptable where it was not for `xlsx` is which side is reachable — the briefing
only ever writes, from its own strings and a JPEG it made; the parser a future advisory
would most likely be against is code this build does not run.

**The Content Security Policy shaped the photo path.** The first surface decoded through
an `<img>` with an object URL and the thumbnail was an object URL too; both were refused
by `img-src 'self' data:`. The choice was to widen a header the suite asserts or to
avoid the URL, and avoiding it cost nothing: `createImageBitmap` decodes from the file
with no URL, and a thumbnail of tens of kilobytes is fine as a `data:` URL. The cost is
stated in the surface's header — the bitmap API's EXIF orientation handling on the target
phone is unobserved.

**The cipher's bytes check is by tag, not `instanceof`.** The fake database clones rows
with `structuredClone`, and under jsdom the clone comes back from another realm, so
`instanceof ArrayBuffer` said no to an ArrayBuffer. That is a real hazard — a buffer out
of a worker has the same property — so the check became `Object.prototype.toString`,
and the refusal in both directions still holds.

**The eval gate will run on this PR, and the reason is the schema.** Two watched files
changed: the eval runner's event fixture and the dictation roster fixture, each because
v6 added fields to the records they build and the typecheck required them. Nothing that
reaches the model changed. About sixteen cents.

**Decisions made in the session rather than read.** The page is 595 by 792 points — A4's
width and Letter's height — so one page prints unscaled on either paper. The footer is
two lines, because the expected-attendance statement did not fit beside the event and
the page count on one; the first render cut it at "as of 15" and the rasterised page
showed it. A character the standard fonts cannot encode is drawn as "?" rather than
failing the document. The attendee view flushes pending briefing notes before it goes
away, and the capture screen re-reads the attendee list when the view returns to the
briefing, because the briefing and the PDF read the notes off that list — the first run
of the end-to-end spec showed the stale label. Contact emails in every fixture are empty:
the denylist refuses any address-shaped string in a tracked file, invented or not, and
that is the rule working. `deleteAttendee` exists in the repository with its cascade and
a test; nothing in the interface calls it yet.

**Not done, and said so.** A real phone photo has not been through this. `CLAUDE.md`'s
list of decision records stops at ADR-0005 and has since 0006; a finding for the owner,
not something this session edits.
