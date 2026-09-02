# Handoff template

Copy this to `docs/HANDOFF.md` at the end of a session and fill it in. Replace the whole
file rather than editing the previous handoff — see *How to use this* at the bottom for
why that matters.

Delete the italicised guidance as you go. It is instruction, not content.

---

# Handoff

*Written `<date>`, at `<commit>` on `main`.*

*One line stating that every claim was checked against a source, and that gaps are named
rather than smoothed over.*

---

## What this is

*Orientation only, for someone who has not seen the repository. What the project is, the
public/private split, and what "load-bearing governance" means in practice here.*

*Belongs here: enough to make the rest of the document legible. A pointer to
`docs/PROJECT-PLAN.md` for the detail.*

*Does not belong here: the plan's content. If this section grows past a few paragraphs
it has become a second copy of the plan and will drift from it.*

---

## Where we've been

*What has actually shipped, in order, with commit SHAs or PR numbers.*

*Belongs here: facts from `git log`, `gh pr list`, and `gh issue list`. Group by build
guide session where the mapping is clear. Note PRs that were closed rather than merged,
and why, because a closed PR is easy to mistake for one that never existed.*

*Does not belong here: recollection. If a claim cannot be traced to a command you ran
this session, either verify it or leave it out. Also not a changelog — `CHANGELOG.md`
already exists and this should not duplicate it.*

---

## Where we are

*The current state of `main`, and what the signals actually mean.*

*Belongs here: the tip commit, whether the working tree is clean, open PRs, CI status,
branch protection and its required checks. Crucially: what each green check does and does
not prove. A reader who takes a green badge at face value should be corrected here.*

*Belongs here: gaps in the documentation set against plan §4.6, and any stated "done
when" that is not in fact met.*

*Does not belong here: a list of open issues or beads. Those live in the trackers and are
pointed at from the next section.*

---

## What's next

### `<Next session — title from the build guide>`

*A pointer, not a substitute. Say what the session covers, its budget, and its "done
when" verbatim enough to be useful — then send the reader to
`docs/BUILD-GUIDE.md`. Anyone starting the session must read the guide entry in full.*

### Where outstanding work lives

*Three places, and the boundary between them is a working agreement in `CLAUDE.md`.*

*Beads — internal build state: findings, deferred decisions, open questions. Give the
commands (`bd ready`, `bd blocked`) and describe the shape of the backlog. **Do not list
the beads.***

*GitHub issues — public record: anything a public reader should see. Name the open ones
and any non-obvious reason one is stuck.*

*ADRs — decisions: point at `docs/adr/README.md` and state the amendment convention.
Name any ADR a session deferred.*

*Does not belong here: the contents of any of the three. A handoff that copies the
tracker drifts from it, and the drift is invisible until someone acts on the stale copy.*

---

## How to work in this repo

*The rules that are easy to get wrong and expensive to get wrong. Keep this stable
between handoffs; it changes only when a working agreement changes.*

*At minimum: read the build guide session in full before writing prompts for it; the
`CLAUDE.md` constraints are not optional; never `--no-verify`; `gh pr create` without
`--fill`; one session, one PR; separate commits per logical change.*

---

## Known gaps in this document

*What could not be verified, stated plainly.*

*Belongs here: claims that are inference rather than record, estimates presented
elsewhere as if they were measurements, and anything the repository has no visibility
into.*

*This section is not an apology and should not be omitted when it would be short. An
honest gap is more useful to the next session than a confident error, and a handoff with
no gaps section usually means the gaps went unrecorded rather than that there were none.*

---

## How to use this

**Regenerate, do not edit.** Write each handoff by re-reading the sources — `git log`,
the build guide, `CLAUDE.md`, `docs/adr/README.md`, `bd ready`, `bd blocked`, and the
open GitHub issues. Editing the previous handoff in place means each version is written
from the last one rather than from the repository, and the document drifts a little
further from the truth every session while looking more authoritative each time.

**Point, do not copy.** Anything with a canonical home — the plan, the build guide, the
trackers, the ADRs — gets a pointer. The moment this file restates them it becomes a
second source of truth that no one updates.

**Every claim traceable.** To a file, a commit, or a command run while writing. If it is
not, say so in *Known gaps* rather than dropping it silently or asserting it anyway.
