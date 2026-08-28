## What this changes

<!-- What and why. Link the issue or ADR if there is one. -->

## How it was verified

<!-- What you actually ran or exercised, not what you expect to pass. -->

---

## Checklist

Tick what you have verified. If an item does not apply, strike it through and say why
in a sentence — an unticked box with no explanation reads as an unanswered question,
and the point of the list is that the answers are on the record.

- [ ] **Eval suite passes.** `pnpm evals` is green, or the run is attached below.
      Note that this spends real API budget and does not run on push. If the change
      touches a prompt template or a guardrail ruleset, its version is incremented and
      the change is reflected in the audit schema.

- [ ] **Denylist check passes.** `node scripts/check-denylist.mjs --all` is clean
      locally, with `.denylist.local` present. CI runs this too, but CI enforces
      **structural patterns only** — it cannot see the term list. A green check from CI
      is not evidence that the term check ran.

- [ ] **No real personal data added.** No real name of a person, institution, or
      manufacturer appears in source, fixtures, tests, comments, commit messages, or
      documentation. All example data is synthetic and obviously so. This applies to
      the diff and to the commit messages carrying it.

- [ ] **ADR written**, if this is an architectural or governance decision. Numbered
      sequentially in `docs/adr/`, following the existing format, recording the
      rejected alternatives and the reasoning. The rejections are as much a part of the
      artifact as the decision.

- [ ] **Schema migration included**, if the Dexie schema changed. Migration written and
      the schema version bumped. Verify an upgrade from the previous version against a
      populated database, not an empty one.

## Constraints touched

Tick anything this change comes near, so review can focus there. Any tick means the
change needs a second look at the constraint in `CLAUDE.md`, not that it is wrong.

- [ ] The pseudonymization boundary, or any new code path that sends content to a model
- [ ] Claim-bearing text — anything describing product characteristics, indications, or
      performance
- [ ] The human review gate, or the `generated` → `reviewed` → `exported` state machine
- [ ] The audit record schema, or what is written to it
- [ ] Anything that adds a network egress path, a dependency that phones home, or a
      third-party script
