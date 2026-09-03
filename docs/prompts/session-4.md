# Session 4 kickoff prompt — the privacy boundary

Session 4 — The privacy boundary

Before anything else. Read, in full, in this order: CLAUDE.md; docs/BUILD-GUIDE.md — session 4 in full, and session 5 well enough to know what is not yours; docs/PROJECT-PLAN.md §4.1 and §4.5; docs/HANDOFF.md; ADR-0001 and ADR-0005.

Then run a verification pass and report before writing any code.

Verify each item below against the repository before acting on it. If something is already resolved, already documented, or stated wrongly in this prompt, do not build around it — stop and tell me.

Clean start. Working tree clean, no open PRs, branched from main at 7a7bdf8 — or later if main has moved, and say which.

git config core.hooksPath reads .husky/_. Check before your first commit and after every bd command.

The data-access API. Read src/lib/db/ and confirm what a tokenizer needs: how attendees are stored, the exact displayName field, and how notes relate to them. Do not assume the shape from plan §5's prose.

bd show fieldnote-quy. It records a correction to docs/HANDOFF.md that has not been applied: session 3's finding is described as "the app could hold only one event ever," which is wrong twice over. When you regenerate the handoff at the end of this session, do not reproduce that phrasing. The bead points at a line number in a document you will replace whole, so it will not apply itself.

Do not rename any CI job. Branch protection requires Verify, Adversarial guardrail suite, and Analyze (javascript-typescript) by display name.

## What to build

src/lib/privacy/pseudonymize.ts — stable tokenization of names, rehydration, and a guard that throws if an untokenized string reaches the API client. Budgeted at ~2–3 hours; it will likely run longer because of the structural rule below.

Roster matching. Names from the event's attendees, replaced with stable tokens ([HCP_1], [STAFF_2]), rehydrated locally. The nasty cases the guide names: names inside note prose, possessives, initials, a surgeon sharing a surname with a staff member.

A structural rule, which is new and is the heart of this session. Roster matching alone cannot catch a name the roster does not know — including a name device dictation mangled between the roster entry and the note. So: a token following a title is treated as a name whether or not it matches the roster, and if it does not match, it is tokenized as an unknown name rather than passed through.

Titles include at minimum Dr., Dr, Doctor, Prof., Professor, Mr., Ms., Mrs., and the postfix credentials RN, NP, PA. Propose the full list back to me before implementing it.

Two things about this rule:

It is fail-closed. An unrecognized token after a title is an unknown name, not a string to leave alone. Silently passing what it does not recognize is the bug this rule exists to fix.

It will overreach, and that is the correct direction. Tokenizing something that was not a name costs a slightly odd draft; missing one is the failure the entire architecture exists to prevent. State that asymmetry explicitly — a reviewer should read it as a decision, not an accident.

Roles are the gap this rule does not close. Real notes refer to people as "the Biomed Director," "the CEO," "the resident coordinator," "the director of finance and capital." In a single-institution note those identify a person as surely as a surname. The structural rule does not see them. Do not build role detection this session — say in the report what you would do about it, and bead it.

## The dictation fixtures

The corpus lives at private/dictated-notes.md. It is gitignored, pre-de-branding material. You may read it. Everything below governs what may come back out.

Nothing from that file appears anywhere in the repository unsubstituted. Not in a fixture, a test, a comment, a commit message, a PR body, a bead, or the handoff. Per plan §7 as amended, that covers names and product and commercial detail — product characteristics, competitive pricing comparisons, regulatory indication status. Each identifies the manufacturer to an industry reader with every name already removed. What the fixtures need is the shape of the dictation: run-ons, homophones, missing punctuation, abandoned sentences, a claim-shaped question. The shape survives substitution intact.

Produce a substitution table before writing any fixture, and stop. Every real term you are replacing and what you are replacing it with. I will review it and approve before you write anything. Do not include the surrounding sentence — the term and its replacement only.

Note what that file does and does not contain. Every person in it is an initial or a role — there are no surnames to be mangled. So the mangled-name cases cannot be written from it, and any fixture that claims otherwise is false.

Use this material for the mangled-name cases instead. One observed pair, from a phone dictation test today: the speaker said Swali; the device produced Swelha. Same initial consonant, different length, different vowels — no edit-distance or fuzzy matcher tuned tightly enough to avoid firing on ordinary prose will catch that. It is the case the structural rule exists for.

In the same test, four other dictated surnames came through clean. Record that: sample of five, one severe mangling, four correct. It matters because the build guide asserts that dictation mangles surnames as settled fact, and the only evidence anyone has gathered says the failure is rare and severe rather than constant and mild. Rare means the user will not be watching for it; severe means fuzzy matching will not save you. Flag the guide's premise as under-evidenced in your report — do not amend the guide, that is my call.

Additional constructed cases, labelled as constructed in the fixture header: a transposed-letter near-miss of a roster name; a name the device rendered as an unpronounceable fragment; and surnames that are also common nouns — Green, Orange, Rome, Piper. That last class cuts both ways: catch Dr. Green while leaving "the green light on the console" alone.

No real physicians' names, including ones found publicly. ADR-0001 does not have a public-figure exception. Common surnames used generically are fine; a name lifted from a real directory is not.

## Scope guard — do not build any of this

No API route, no Anthropic SDK call, no prompt or guardrail module, no security headers, no single-egress CI check. Session 5. Build the boundary before the thing that crosses it: the guide is explicit that if generation exists first you will wire it up and retrofit the boundary, and retrofitted boundaries leak.

No audit records, no draft state machine, no review gate. Session 6.

No eval cases, no eval runner, no README, no badge. Session 7.

No roster import. Session 8.

No role detection. Named above; bead it.

No schema change. If the tokenizer seems to need a field, stop and tell me.

No Dexie import outside src/lib/db/.

## Constraints

Never --no-verify — if the hook fires, stop and show me the output. gh pr create without --fill. Separate commits per logical change; the fixtures go in their own commit, isolated from the tokenizer code, so the diff I have to read closely is small. Merge commit, not squash. One session, one PR. TypeScript strict, no any without an adjacent comment. Prefer the plainly correct implementation. The last commit regenerates docs/HANDOFF.md from the template by re-reading sources — see verification item 4.

## Stop conditions

Stop and report rather than deciding, if: the substitution table is ready (mandatory stop); the title list is ready for approval (mandatory stop); anything requires a schema change; anything requires a new network destination or dependency; the hook fires; or the structural rule turns out to need a design decision I have not made here.

## Done when

A test asserts no raw name can reach the API client, and fails if you remove the guard — demonstrate the counterfactual, do not assert it. Roster names, possessives, initials, and shared surnames all tokenize. Swelha is tokenized as an unknown name via the structural rule despite matching no roster entry. Dr. Green tokenizes while "the green light" does not. Rehydration round-trips. pnpm test, typecheck, lint, and build green.

## Report back

(1) Verified vs assumed, with the command or file for each. (2) The substitution table, before anything else. (3) What you built, file by file. (4) Where you were tempted toward a shortcut. (5) Beads created. (6) Flags last — including what you would do about roles, and anything that looked wrong in the plan, guide, handoff, or this prompt.

---

## Two additions sent mid-session

Both arrived while the session was running and both changed the work, so they belong with
the prompt rather than in the transcript.

**1. An ADR for the structural rule.**

One more thing this session owes: an ADR for the structural rule. It is a substantive change to what the pseudonymization boundary means — roster matching plus structural detection plus a fail-closed guard, rather than roster matching alone — and it embeds a deliberate asymmetry, that over-tokenizing is preferred to under-tokenizing. Record both, and record the rejected alternatives with their reasoning: fuzzy or phonetic matching, defeated by the observed Swali → Swelha pair, which no matcher tuned tightly enough to avoid firing on ordinary prose will catch; and roster-only matching, which silently passes the case it cannot see.

Number it ADR-0006 unless the index says otherwise — verify against docs/adr/README.md rather than assuming. Follow the existing format. State the residual risk plainly: roles are not covered, and the rule's evidence base for mangling is a five-name sample.

Update the index in the same commit, and while you are in there, fieldnote-fpm — ADR-0004 and ADR-0005 show as plain "Accepted" though both carry dated Amended lines. That is a two-minute fix and you are already editing the file. Close the bead.

**2. Fail-closed must not mean an error instead of a draft.**

One thing to be deliberate about: fail-closed must not mean the representative gets an error instead of a draft. An unrecognized token after a title is tokenized as an unknown name and generation proceeds — she never sees a failure for that case. The guard throwing is reserved for a raw name genuinely reaching the API client, which should be unreachable if the tokenizer works. Say in the ADR which conditions can actually surface an error to her, and keep that set as small as it can honestly be. A tool that refuses to draft in a parking lot is a tool she stops using, and then the boundary protects nothing.

---

## How it actually went, for whoever reuses this

Both mandatory stops worked as intended and both produced changes. The substitution table
came back with two corrections — one of which caught that "hook" is itself a real
instrument in the source device category, so the proposed replacement had barely changed
anything. The title list was approved with `Sister`/`Sr` dropped as US-territory noise.

The prompt's premise about the corpus was confirmed rather than corrected: every person in
`private/dictated-notes.md` is an initial or a role, so the mangled-name cases came from
the observed pair plus constructed cases, each labelled by provenance.

The build guide's dictation premise was flagged as under-evidenced, as instructed, and
left for the owner to amend.
