# Session 17 — Compliance map

**There is no prompt file for this session in the usual sense, and that is the first
thing worth recording.** Every session from 3 onward was driven by a written prompt
prepared outside the repository. Session 17 was not. The owner's instruction, in full,
was to clear the open dependency issues and then *"let's get going on 17"*.

So the scope came from the build guide's own entry, which the handoff had already
identified as sufficient: *"~3 hours, no bead, the guide's entry is the scope."* That
entry reads:

> **Session 17 — Compliance map.** Controls mapped to NIST AI RMF, EU AI Act, ISO/IEC
> 42001. Be precise about the risk tier rather than expansive; accuracy reads better
> than overclaiming.
>
> The same precision applies to controls not built. Map ADR-0004's seam as what it is,
> and cite the ADR, rather than mapping encryption-at-rest as implemented.

Plan §4.6 adds the standard the document is written to, and it is the sharper statement
of the two:

> On the EU AI Act mapping: be precise rather than expansive. This system is not
> high-risk under Annex III. It is a limited-risk system whose main obligation is
> transparency. Saying so accurately, and then voluntarily implementing Article 12-style
> logging anyway with a clear rationale, reads as far more competent than overclaiming a
> risk tier. Reviewers notice the difference.

`docs/THREAT-MODEL.md` §6 closes by naming what this session would need and where it is,
which turned out to be accurate and saved the session from rediscovering it:

> What sessions 16 and 17 will need from here, and where it is: the data inventory and
> the flow are §2 and §3.3's first column; the retention dependency is the second item
> above; the controls that are enforced and the ones that are documented are the third
> column of every table in §3; and the compliance map should map ADR-0004's seam as what
> it is — a seam — and cite the record, not this document, for the decision.

---

## How it actually went, for whoever reuses this

**The dependency work came first and was not trivial.** Twelve days had passed with no
commits and seven Dependabot alerts had opened, all against one development-scope
package. Three pull requests were waiting. The order mattered more than it looked:
merging the group bump first cleared the alerts, and the undici PR then had to be
**closed rather than merged**, because it had been built against an older `main` and
merging it would have rolled back the SDK and the framework. A green, mergeable
Dependabot PR can still be a regression. Read what it would do to the branch it is
merging into, not just what it claims to bump.

**Then two new alerts opened the same morning, and Dependabot could not fix them.** Its
own run failed with `dependency_file_not_resolvable`, because the package was transitive
and pnpm resolved the two affected version lines differently than the advisory asked.
Waiting for a PR that was never coming would have left the alerts open indefinitely. The
fix was `pnpm update <pkg> -r`, which worked without an override because the existing
ranges already admitted the patched versions. `fieldnote-6gq` records the technique:
when an alert has no PR, read the Dependabot run log before assuming the PR is late.

**The map's hardest section was the one with the least material.** ISO/IEC 42001 is
paywalled and this project does not hold a copy. The options were to cite control
identifiers from memory, to omit the standard, or to map the standard's shape honestly
and cite no identifiers at all. The third is what the document does, and it says so
twice — once in the preamble and once at the head of the section — because a plausible
clause number is worse than no clause number: it invites a reader to check it against a
document they may not have either.

**The negative headline was the right call there too.** ISO/IEC 42001 specifies a
management system. This project has one maintainer and no organisation, so it has no AI
management system and could not be certified. Writing that in the first line of the
section, and then showing that the *operational* half of the standard is substantially
present, says more than a table of partial credit would.

**Article 50 is where the work paid off.** Three of its duties were answerable and the
fourth was not. The duty to mark synthetic content in machine-readable form is not met:
the assistive-editing exemption covers the claim-bearing text, which is selected from
the library rather than authored, but not the generated relational prose around it, and
exported drafts carry no marker because export is a clipboard copy. That is a real gap,
it is now `fieldnote-lr8`, and the map states it as a gap rather than arguing its way
out of it. A compliance map that finds nothing has not been written carefully.

**Reading the sources turned up a defect in a published document.** `README.md`'s prose
for the held-out eval run says six produced violations and attributes three to the
off-label case; the table directly above it says four, with off-label at one, and the
per-class rows sum to four. The paragraph describes the previous run under ruleset 1.3.0
and was carried forward when the table was updated. The map cites the table, whose rows
are internally consistent, and the discrepancy is `fieldnote-12k` for session 18, which
owns `README.md`.

**Every citation was checked mechanically before the commit.** Each file path, test
file, and bead id in the document was verified to exist. Three bead ids in the first
draft were placeholders invented while writing, and the check caught all three — in a
document whose entire argument is that claims should point at something you can
inspect, a dead reference would have been the worst possible defect.

**Spend.** $0. No watched path changed, so the adversarial suite skipped the model.
