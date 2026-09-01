# ADR-0003: read-excel-file for spreadsheet parsing, replacing xlsx (SheetJS)

- **Status:** Accepted
- **Date:** 2026-08-28
- **Deciders:** cp48isme (owner)
- **Amended:** 2026-09-01 — two consequences added to the Negative list. The decision is
  unchanged.

## Context

Roster import (project plan §3.1, build guide session 8) reads attendee sign-in sheets
supplied as Excel or CSV files and parses them entirely in the browser. The scaffold
took a dependency on `xlsx` (SheetJS) for this. No parsing code has been written yet,
which makes this the cheapest possible moment to change library.

Dependabot reports four open alerts, all `xlsx@0.18.5`, all direct, two distinct
advisories counted once per manifest:

| Advisory | Severity | Affected | Description |
|---|---|---|---|
| CVE-2023-30533 | High | `< 0.19.3` | Prototype pollution |
| CVE-2024-22363 | High | `< 0.20.2` | Regular expression denial of service |

**No registry update resolves these.** The `latest` dist-tag for `xlsx` on the npm
registry is `0.18.5`, published 2022-03-24, and it is the newest of the 108 versions
there. The package is not marked deprecated, so nothing signals the situation to a
developer running `pnpm add xlsx`. SheetJS moved distribution to their own CDN from
`0.19.x` onward; the patched releases exist, but not anywhere the package manager
looks. GitHub's own alert data states the position plainly: `first_patched_version` is
**null** for both advisories.

The vulnerable code path is parsing a crafted spreadsheet. That is not an incidental
capability we happen to link against — it is precisely and only what this dependency
is here to do, on files that arrive from outside the system. A sign-in sheet is
untrusted input by definition: it is filled in at an event, emailed around, and opened
on the representative's laptop. These alerts cannot be dismissed as unreachable,
because the reachable path is the feature.

## Decision

**Replace `xlsx` with `read-excel-file`.**

`read-excel-file` is actively maintained (9.3.10, published 2026-08-10), MIT licensed,
carries no open advisories, and installs cleanly from the public registry. After the
swap `pnpm audit` reports no known vulnerabilities.

It is also **read-only**, and that is the substantive reason rather than a convenient
footnote.

Fieldnote reads spreadsheets. It never writes them. Roster import parses a file into
attendee records and that is the whole of the requirement — there is no export-to-Excel
feature, and the system's only export path is clipboard-only by deliberate design
(project plan §4.3). A library that can write spreadsheets carries encoding, formula
construction, and file generation code that this application will never call, and every
line of it is still in the bundle and still in the dependency's attack surface.
Choosing a parser that *cannot* write is choosing a smaller thing to trust.

This mirrors the reasoning applied elsewhere in the system: the tool has no SMTP client
because it must not send, not merely because it does not send today. Capability absent
by construction is worth more than capability present but unused.

## Alternatives considered

**Pin the patched CDN tarball via a pnpm override.** SheetJS publishes `0.20.x` at
`https://cdn.sheetjs.com/`, and pnpm can resolve a dependency to a URL. This would
close both CVEs while keeping the library.

Rejected. It replaces a registry dependency with a direct HTTPS fetch from a
single-vendor CDN, resolved at install time, on every developer machine and every CI
run. That trades a known vulnerability for a supply-chain dependency with materially
worse properties: no npm provenance or signature to verify against, integrity resting
on whatever hash is committed to the lockfile at the moment of pinning, availability
tied to one vendor's CDN uptime for the build to work at all, and Dependabot blind to
it thereafter — a URL dependency is not a registry dependency and will not be watched
for future advisories. In a repository whose stated subject is governance, introducing
an unmonitored, unverifiable install-time fetch to silence a vulnerability alert is the
wrong trade, and it would be difficult to defend to a reviewer reading the ADRs.

**Dismiss the alerts as not applicable.** Mark them dismissed in Dependabot with a note
that parsing is not yet implemented.

Rejected, and it is worth being precise about why, because this is the option that
would have been easiest. The alerts are not false positives. The vulnerable path is
reading a crafted spreadsheet, roster import will do exactly that, and the input is
untrusted by nature. Dismissing them would mean the repository's security posture
appeared clean while the exposure remained, and a dismissal recorded now would sit
silently in the settings until session 8 shipped the code that made it wrong. A
governance project that dismisses inconvenient true positives has demonstrated the
opposite of what it claims to demonstrate.

**Write a minimal parser in-house.** Rejected without extended analysis. Spreadsheet
formats are complex and the failure modes are subtle; a hand-rolled parser would be a
larger risk than either library, and the effort belongs in the guardrails instead.

## Consequences

**Positive**

- Four high-severity open alerts resolved; `pnpm audit` clean.
- The dependency can no longer write files, so an entire class of capability is absent
  by construction rather than merely unused.
- The dependency is maintained and watched by Dependabot, so a future advisory produces
  an alert and a patch path rather than a dead end.
- Changed before any parsing code exists, so the migration cost is a package.json line
  rather than a rewrite.

**Negative**

- `read-excel-file` has a narrower API than SheetJS. If a future requirement genuinely
  needs spreadsheet *writing*, this decision must be revisited rather than worked
  around — which is the intended behaviour, and should be a new ADR.
- CSV handling is a separate concern in `read-excel-file` rather than unified with
  Excel parsing, so roster import will handle the two formats through different entry
  points.
- Less community material and fewer worked examples than SheetJS, which is the more
  widely used library despite its maintenance state.
- **Added 2026-09-01.** `read-excel-file` reads the OOXML `.xlsx` format only. SheetJS
  additionally reads the legacy binary `.xls` format, and this decision gives that up.
  Sign-in sheets are exactly the kind of artifact that arrives as a file someone saved
  from a desktop copy of Office years ago, so the gap is not theoretical. Session 8 must
  therefore detect `.xls` explicitly and tell the user to re-save as `.xlsx`, rather
  than failing with a parse error that looks like a bug. That is an acceptable answer —
  it is one instruction, and adding a legacy binary parser back into an untrusted-input
  path to avoid giving it would invert the whole decision — but it should be a
  deliberate, implemented behaviour rather than a surprise discovered at an event.
- **Added 2026-09-01.** SheetJS has absorbed a decade of pathological real-world
  spreadsheets. `read-excel-file` has not, and its behaviour on merged header cells,
  stray formatting rows, and multi-row headers is less proven. Budget session 8's column
  mapping UI accordingly; it may need to tolerate more input shapes than expected.

**Residual risk — not mitigated by this decision**

Changing library reduces known exposure. It does not eliminate the underlying risk, and
this ADR should not be read as claiming otherwise.

Any parser that reads untrusted, structurally complex binary files is an attack
surface. `read-excel-file` has no advisories today; that is a statement about what has
been found and disclosed, not a proof of absence. XLSX is a ZIP container of XML, which
means decompression and XML parsing before any of our code runs, and zip-bomb and
XML-entity classes of attack apply to any library in this category. A future CVE
against this dependency is a reasonable expectation, not a remote possibility.

What actually bounds the damage is the surrounding architecture, and those properties
are what should be relied upon:

- Parsing happens client-side, in the browser sandbox, on the user's own device. There
  is no server-side parsing endpoint to attack, and no other tenant to affect.
- The file never leaves the device and is never persisted server-side.
- The application holds no server-side user data, so a successful parser exploit
  compromises one local session rather than a dataset.
- Roster import must treat parsed output as untrusted regardless of library: validate
  and normalise every field before it reaches Dexie, and never pass parsed content into
  a model call without routing it through the pseudonymization boundary.

The last point is the one to carry into session 8. A library choice is not a substitute
for treating imported data as hostile.
