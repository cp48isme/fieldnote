# ADR-0010: pdf-lib for producing the briefing document

- **Status:** Accepted
- **Date:** 2026-09-15
- **Deciders:** cp48isme (owner) — that the briefing is a real download produced on the
  device, not the print path; the library itself by the session that implemented it,
  from the material below

## Context

ADR-0009 decided that the briefing is a document the application lays out from what the
representative enters and offers as a download, never sends, and that no model writes
any of it. Build guide session 11 builds it. The document carries the most identifying
material in the system — attendee names, roles, institutions, photographs, and the
representative's own notes about each person — so the thing that produces it is part of
the privacy surface, and this repository's rule (ADR-0003) is that a dependency in that
position is chosen on the record, with the rejected options and their reasoning kept.

Three candidates. The material was gathered on 2026-09-15 from the npm registry, the
GitHub advisory database, and a scratch install of each library with `npm audit`;
nothing was installed in the repository until this record was written.

| | `pdf-lib` | `jspdf` | Browser print path |
|---|---|---|---|
| Version | 1.17.1 | 4.2.1 | — |
| Last published | 2022-05-12 | 2026-03-17 | — |
| Runtime dependencies | 4 (`pako` 1.x, `tslib` 1.x, `@pdf-lib/standard-fonts`, `@pdf-lib/upng`) | 3 required (`@babel/runtime`, `fflate`, `fast-png`) plus 4 optional (`canvg`, `core-js`, `dompurify`, `html2canvas`) | none |
| Packages in a scratch install | 4 | 21 | — |
| Unpacked size | 19.5 MB (1,647 files: CommonJS, ES, and UMD builds with maps) | 30.2 MB | — |
| Advisories, ever, on the package | none | ten in 2026 alone: two critical, six high, two medium | — |
| Advisories open at this version | none | none — every one is patched at or below 4.2.1 | — |
| Advisories on its dependencies at the installed versions | none | none (`fflate` and `@babel/runtime` each had one, both patched below the versions installed) | — |
| `npm audit` on the scratch install | clean | clean | — |
| Licence | MIT | MIT | — |

**What each carries that this application will not use.** `pdf-lib` reads and modifies
existing PDFs — parsing an untrusted document is a code path it has, and one the briefing
never calls, since it only ever creates. It fills and flattens forms. `jspdf` embeds
JavaScript in a PDF (`addJS`), builds interactive AcroForms, renders HTML into a document
through `html2canvas`, opens documents in new windows, and decodes GIF and BMP. Nine of
its ten advisories are in exactly those paths: injection through the AcroForm and
`addJS` modules, HTML injection in the new-window path, denial of service in the GIF and
BMP decoders. They are patched, and they are also a description of a surface this
application has no reason to link against.

## Decision

**`pdf-lib` 1.17.1.**

The deciding reason is the one ADR-0003 gave for `read-excel-file`: choosing the smaller
thing to trust. `pdf-lib` exposes primitives — a page, a standard font, text drawn at a
position, an embedded JPEG or PNG — and that is the whole of what a briefing needs. It
has no facility for putting script into a document, no HTML rendering, no form
interactivity, and no decoder for the image formats that produced two denial-of-service
advisories elsewhere. It installs four packages. In four years on the registry nobody
has filed an advisory against it or against any of the four.

Its age is the cost, and it is stated plainly under *Consequences* rather than argued
away: a library last published in May 2022 will not receive a patch if one is ever
needed. What makes that acceptable here, where it was not acceptable for `xlsx` in
ADR-0003, is which side of the library is reachable. ADR-0003's dependency parsed
untrusted files, so a parser advisory was an advisory against the feature itself. The
briefing feeds `pdf-lib` the application's own strings and a JPEG the application
produced from a photograph the representative chose; it never loads a document. A
future advisory in the parser would be against code this build does not run. One in the
writer would be reachable, and the writer's input is under this application's control.

`jspdf` is the better-maintained library and the worse fit. Ten advisories in a year is
evidence that its surface is being examined, and evidence of how much surface there is.
Every one is patched at 4.2.1, so it does not trip the rule that a candidate with an open
advisory is not installed; it would nevertheless have Dependabot reporting on modules the
application never calls, and each report would need a reader to establish that the path
is unreachable — the situation ADR-0003 chose a read-only parser to avoid.

The print path — `window.print()` with page-media CSS, no dependency at all — was the
owner's decision to reject before this record was written, and the reason belongs here.
On iOS, printing reaches the share sheet and produces a save; it does not produce a
download, and ADR-0009 says download. The layout would also depend on each browser's
print engine, which on the target phone is the one part of the platform the application
cannot test from the suite, and the guide's warning that this session's layout is fiddly
is a warning about exactly that engine.

## Alternatives considered

**`jspdf` 4.2.1.** Maintained, and clean at its current version. Rejected for the surface
it carries — script embedding, forms, HTML rendering, image decoders — none of which the
briefing uses, and all of which its advisory history is about. Twenty-one packages
against four.

**The browser print path.** Rejected by the owner: it does not produce a download on
the target platform, and its layout is at the mercy of the print engine.

**Writing PDF by hand.** A page of text and an embedded JPEG is a few hundred lines of
PDF syntax, and the roster fixture generator already writes a ZIP by hand for the same
reason this record prefers small things. Rejected, though not without thought: font
metrics for line wrapping, the cross-reference table, and image object encoding are each
a place to be subtly wrong in a document that a printer will refuse rather than
explain, and a document that gets forwarded and printed is the wrong place to learn
them. `pdf-lib`'s standard-font metrics are the part that would be hardest to get right
in-house.

**Embedding a full Unicode font through `@pdf-lib/fontkit`.** Not a candidate for the
decision but a choice inside it: the standard fonts cover WinAnsi — Western European
Latin, the typographic quotes and dashes — and nothing beyond. The briefing uses the
standard fonts and substitutes a mark for any character they cannot encode, states that
in the builder's header, and does not add a fifth package and a font file to remove a
limit nobody has yet hit. If a real roster hits it, that is a new consequence here, not
a workaround.

## Consequences

**Positive**

- Four packages, none with an advisory on record, and a surface that consists of
  creating documents from the application's own data.
- No path by which a document produced here can carry script, a form, or rendered HTML.
- The builder is a pure function over records, testable without a browser, because the
  library has no DOM dependency.

**Negative**

- **Unmaintained.** Last published 2022-05-12. If an advisory is ever filed against the
  writer, there will be no patched release, and the choice is to vendor a fix or to
  replace the library under a new ADR. `tslib` 1.x and `pako` 1.x are old majors held
  at their last releases for the same reason.
- **Standard fonts only.** A name or a note containing a character outside WinAnsi —
  most non-Latin scripts — is rendered with a substitution mark. The builder says so.
- **Dependabot has nothing to report on a package that never publishes**, so silence is
  not evidence of health. Whoever runs session 15's threat model should read the
  advisory database for this package by hand.

**Residual risk, stated plainly**

The briefing document, once written, is outside the system (ADR-0009), and no choice of
library changes what happens to it after download. What this decision bounds is the
document's construction: it can contain only what the builder draws, from records the
representative entered, and the library used to draw it has no facility for anything
else.
