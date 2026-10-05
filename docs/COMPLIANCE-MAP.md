# Compliance map

Controls mapped to the NIST AI Risk Management Framework 1.0, the EU AI Act, and
ISO/IEC 42001:2023.

Written 2026-10-05, session 17, against `main` at `ce16360`.

This document maps what exists. Where a framework expects a control this system does not
have, the row says so and points at the record that decided it, because a map whose every
row is satisfied is a map nobody checked. Plan §4.6 sets the standard it is written to:
*be precise rather than expansive — saying so accurately, and then voluntarily
implementing Article 12-style logging anyway with a clear rationale, reads as far more
competent than overclaiming a risk tier.*

---

## 1. How to read this

**The unit of this map is a control that exists, with the thing that holds it.** Every
row cites a test, a decision record, a file, or a platform setting. A row whose evidence
column says *documented, not enforced* is a control the system does not have; it is in
the map because the framework asks about it and the honest answer is useful.

**The vocabulary is borrowed from `docs/THREAT-MODEL.md` §3**, which already separates
controls that fail a build from controls that are written down. This document does not
restate that distinction per control; it points at the boundary tables that carry it.

**Nothing here restates the threat model or the assessment.** The threat model is the
control inventory by boundary, its §6 is the residual list, and
`docs/DATA-PROTECTION.md` is the data inventory, the flows, retention, minimisation,
rights, and processors. This map's job is the third thing: which published expectation
each of those answers, and which it does not.

**The standards' own text is not reproduced here**, and two of the three were not read
from an authoritative copy while writing. NIST AI RMF 1.0 is published free by NIST and
its four functions and category structure are stable and well known. The EU AI Act is
free in the Official Journal. ISO/IEC 42001:2023 is paywalled and this project does not
hold a copy. The consequence is stated plainly in §8 and repeated at the head of §5:
clause and control identifiers in the ISO section are given at the level this map can
state honestly, and anyone relying on them for an audit must check them against the
purchased standard rather than against this file.

**Scope is the public build.** The private fork is ADR-0001's subject and this
repository has no visibility into it (`fieldnote-v2s`). Where a control's real-world
behaviour depends on the fork or on a platform setting, the row says the verification
happens elsewhere.

---

## 2. The system, and who is who

The system captures what a field representative learns from attendees at demonstration
events for regulated products and drafts the follow-up correspondence she sends, for her
review before anything leaves her device. It never sends anything. Full description in
`docs/DATA-PROTECTION.md` §1.

**The AI component is one call.** A single request to a hosted general-purpose model,
through one route, carrying pseudonymized text. There is no training, no fine-tuning, no
model hosted by this project, no automated decision about any person, and no inference
about an attendee beyond drafting prose a human then reads.

### Roles, under the EU AI Act's definitions

| Role | Who | Why |
|---|---|---|
| Provider of the general-purpose model | Anthropic | Chapter V obligations are theirs, not this system's. This map does not claim them. |
| Provider of the AI system | The owner, for the private fork | The owner develops it and puts it into service for the representative's use. |
| Deployer | The representative, and her employer | Professional use under their authority, so the personal-use exclusion does not apply. |
| The public build | Neither, as published | It is source code under Apache 2.0 with synthetic data and an empty content library. Publishing source is not placing an AI system on the market, and Article 2's free-and-open-source exclusion is written for exactly this case. The exclusion does not extend to the transparency obligations, which is why §3.3 is answered rather than waived. |

**Territorial scope is not established, and this map does not assume it.** The Act binds
providers placing a system on the Union market or putting it into service there,
deployers established there, and third-country parties whose output is used there. This
repository does not know where the private fork runs or where the representative works.
The mapping below is therefore done **as if the Act applied**, voluntarily, because
mapping to it and then discovering it applies is cheap and the reverse is not.

---

## 3. EU AI Act

### 3.1 The risk tier, argued rather than asserted

**Not a prohibited practice (Article 5).** No subliminal or manipulative technique, no
exploitation of vulnerability, no social scoring, no predictive policing, no untargeted
scraping of facial images, no biometric categorisation, and no remote biometric
identification. Two near-misses are worth naming because a reader will look for them.
Article 5 prohibits emotion-recognition systems in the workplace: this system infers
nothing about anyone's emotional state, and the only thing it does with a person is
replace their name with a token. It also prohibits certain workplace monitoring: the
audit trail records the representative's own review and export actions, on her own
device, and exists so a generation cannot be denied, not so anyone can be assessed.

**Not high-risk under Article 6(1).** That route catches an AI system that is a safety
component of a product covered by the Union harmonisation legislation in Annex I, which
includes medical devices. The product being demonstrated at these events may well be
regulated. **This application is not a component of it.** It is a note-taking and
correspondence tool used by the person demonstrating it; it does not control, monitor,
or inform the operation of the product, and no part of the product's safety depends on
it. The distinction is worth stating because the domain sounds regulated and the system
is not.

**Not high-risk under Article 6(2) and Annex III.** The eight Annex III areas are
biometrics, critical infrastructure, education and vocational training, employment and
worker management, access to essential private and public services, law enforcement,
migration and border control, and administration of justice and democratic processes.
None describes drafting follow-up correspondence to professionals a representative met
at an event. The nearest is employment, and it is not close: the system evaluates
nobody, recommends nobody, and ranks nobody.

**Limited risk, with transparency the operative obligation (Article 50).** The system
generates text with a general-purpose model. That is the tier, and §3.3 works through
what it actually requires.

**The honest summary.** One obligation genuinely applies and is answered. Several
high-risk obligations do not apply and are implemented anyway, for reasons that had
nothing to do with the Act, and §3.2 maps those as voluntary rather than as compliance.

### 3.2 High-risk obligations implemented voluntarily

Each of these would be required of a high-risk system. None is required here. Each was
built for its own reason, which is given, because a control adopted for a real reason
is more durable than one adopted to satisfy a list.

| Article | What it would require | What exists | Why it was built |
|---|---|---|---|
| 12 — record-keeping | Automatic logging of events over the system's lifetime | Every generation writes an audit record in the same transaction as its draft: model, prompt template version, guardrail ruleset version, input and output hashes, flags fired, passages used, and the review and export timestamps with the edit distance. A withheld generation is written with its reason and no body. Records survive the deletion of their event. | ADR-0008. So that cleanup cannot destroy the evidence that a generation happened, and so a draft can never exist without its record. `tests/unit/repository-drafts.test.ts`, `tests/unit/pipeline.test.ts`, `tests/unit/audit-csv.test.ts`, `tests/e2e/review.spec.ts`. |
| 14 — human oversight | Natural persons can oversee, interpret, and override | The review gate is a state machine, not a suggestion. A draft moves `generated` → `reviewed` → `exported`, export is unreachable until a human has opened the draft, and nothing leaves `blocked`. There is no batch path. | `CLAUDE.md`'s non-negotiable constraint, predating any mapping. `tests/unit/draft-state.test.ts`, `tests/e2e/review.spec.ts`. |
| 13 — instructions and transparency to the deployer | The deployer is told what the system does and its limitations | `README.md` states what the system deliberately does not do and publishes the eval results including what the model still produced. The threat model and the assessment state every residual. | The repository's argument is that controls should be inspectable. |
| 15 — accuracy, robustness, security | Declared accuracy metrics, resilience, cybersecurity | Published adversarial eval figures (§4, MEASURE); a content security policy with a per-request nonce and `'strict-dynamic'`; one egress; a caller key on the generation route. | Each has its own record: plan §4.5, ADR-0012. |
| 10 — data governance | Training, validation, and testing data governance | **Not applicable in the form the Article means.** No model is trained or fine-tuned here. What exists instead is governance of the data that reaches the model: pseudonymization before the boundary, a closed approved-content library for claim-bearing text, and an inventory of every field in `docs/DATA-PROTECTION.md` §2. | ADR-0001, ADR-0006, ADR-0007. |
| 9 — risk management system | A continuous, documented risk process | `docs/THREAT-MODEL.md` is STRIDE per boundary with a residual section; findings go to a tracker; decisions go to ADRs. It is one maintainer's process, not a management system, and §5 says so. | The project's own standard. |

### 3.3 Article 50, the obligation that does apply

Article 50 carries several distinct duties and only some of them touch this system.
Taking them in turn, because the interesting answers are the ones that need an argument.

**Interaction disclosure.** The duty to inform a person that they are interacting with an
AI system applies to systems intended to interact directly with natural persons. Nobody
interacts with this system but the representative, who built her workflow around knowing
exactly what it is. The attendees never touch it.

**Marking synthetic content in machine-readable form.** This is the duty that needs care
rather than a quick answer. It falls on providers of systems generating synthetic text,
and the drafts are synthetic text. Two things bear on it.

The Article exempts systems performing an assistive function for standard editing that
do not substantially alter the deployer's input data. Part of what this system produces
sits inside that exemption and part does not: claim-bearing text is **selected** from the
approved library and not authored at all, which is assistive in the strictest sense,
while the relational prose around it is genuinely generated. This map does not claim the
exemption covers the whole output, because it does not.

What the system does instead is stronger than a marking in one respect and weaker in
another. **Stronger:** nothing reaches a recipient without a human opening it, reading
it, and acting to export it, and the audit record carries the edit distance, so how much
of what was sent is the model's is recorded per draft. **Weaker:** the exported text
carries no machine-readable marker, because export is a clipboard copy into her own mail
client and a marker would have to survive a paste. **This is an open gap, not a
satisfied row.** It is recorded as `fieldnote-lr8`.

**Deployer disclosure for published text.** The duty on deployers to disclose AI
generation applies to text published to inform the public on matters of public interest.
Follow-up correspondence to one named professional is neither published nor a matter of
public interest. The duty also falls away where the content has undergone human review
and a natural or legal person holds editorial responsibility. That is precisely the
review gate, which was built for ADR-0011's reasons years before this mapping. The row is
answered twice over.

### 3.4 Chapter V, general-purpose models

Not this system's obligations. The model is Anthropic's, accessed through their API; the
provider obligations for general-purpose models fall on them. This system is a downstream
user and claims nothing on their behalf. The one fact this map does record about that
relationship is retention, in §6 and in `docs/DATA-PROTECTION.md` §7: zero data retention
is **not** in place on this account, by the owner's decision of 2026-09-21, so the
standard commercial policy applies — inputs and outputs deleted within 30 days, content
flagged by automated trust-and-safety systems kept up to 2 years. What is retained names
nobody, because what crosses is pseudonymized.

---

## 4. NIST AI RMF 1.0

Mapped by function and category. The framework is voluntary and outcome-based, so the
useful column is the last one: what would have to change for the outcome to be better.

### GOVERN

| Category | Outcome | Where it lives | Honest assessment |
|---|---|---|---|
| GOVERN 1 — policies and procedures | Policies for mapping, measuring, managing risk are in place | `CLAUDE.md`'s non-negotiable constraints; the working agreements; ADRs for substantive choices with rejected alternatives recorded | Real and enforced in the places they can be: the denylist runs in a pre-commit hook and in CI, and the constraints have refused changes. |
| GOVERN 2 — accountability | Roles and responsibilities documented | One maintainer, named; `SECURITY.md` commits to a 7-day acknowledgement and 30-day assessment and says explicitly that this is a personal project maintained in evenings | Accountability is unambiguous because there is one person. It is also a single point of failure, and the document says so rather than implying a team. |
| GOVERN 3 — workforce diversity and competence | Diverse teams, training | **Not met and not meetable.** One maintainer. | Stated rather than finessed. A one-person project cannot satisfy a category about team composition, and claiming otherwise would discredit the rows that are real. |
| GOVERN 4 — safety-first culture, critical thinking | A culture that surfaces and documents risk | The repository's habit of recording what was *not* built and why: ADR-0004 declines encryption at rest and argues it; ADR-0005 declines audio capture; ADR-0002 records two rejected designs as the substance of the record | This is the strongest column in the project. The rejections are the artifact. |
| GOVERN 5 — stakeholder engagement | Mechanisms for input from affected people | **Largely not met.** The attendees whose data is captured did not ask to be recorded, which `docs/DATA-PROTECTION.md` §1 states as the central exposure, and there is no channel through which they could object. | `docs/DATA-PROTECTION.md` §6 covers rights and their limits. The gap is real and architectural: the data is on one phone and the subjects do not know it exists. |
| GOVERN 6 — third-party risk | Policies for third-party software and data | A dependency gets an ADR before it is installed (ADR-0003, ADR-0010); every GitHub action is pinned by commit SHA and the pin is verified against the upstream tag rather than trusted; Dependabot on both ecosystems; `--frozen-lockfile`; lockfile diffs are read for new package names | Exercised, not aspirational. ADR-0003 replaced a dependency over two unpatched advisories; ADR-0010 accepts an unmaintained library with the cost written down. |

### MAP

| Category | Outcome | Where it lives | Honest assessment |
|---|---|---|---|
| MAP 1 — context established | Intended purpose, setting, and users are understood | `docs/PROJECT-PLAN.md`; `docs/DATA-PROTECTION.md` §1, which names four classes of data subject | Specific: one representative, one phone, demonstration events. |
| MAP 2 — categorisation | The system is categorised | §2 and §3.1 of this document | The risk tier is argued from the Act's own routes rather than asserted. |
| MAP 3 — capabilities and limitations | What the system can and cannot do is known | `README.md`'s deliberate non-features; the published eval figures including what the model produced; `SECURITY.md`'s triage section ruling out classes of finding | The published figures include the failures. 4 of 70 samples produced a violation in the held-out run of 2026-09-15; none reached a draft. |
| MAP 4 — third-party risks | Risks from third-party components are mapped | `docs/THREAT-MODEL.md` §3.4 for the repository and its tooling; §3.3 for the provider; `docs/DATA-PROTECTION.md` §7 for processors | Includes the platform items recorded as *unverified* rather than assumed: where dictation runs (`fieldnote-8w6`) and whether the store is in a backup (`fieldnote-ap1`). |
| MAP 5 — impacts characterised | Potential impacts to people are characterised | `docs/DATA-PROTECTION.md` throughout; `docs/THREAT-MODEL.md` §1's assets and adversaries | The impact that matters is a clinician's name or a note about them leaving the device. The whole architecture is arranged around that one sentence. |

### MEASURE

| Category | Outcome | Where it lives | Honest assessment |
|---|---|---|---|
| MEASURE 1 — appropriate methods identified | Metrics exist and are applied | The adversarial eval suite, plan §4.5: 14 cases, five calls each, against the real prompt and the live model | The gate is the measurement that matters: whether a violation *reached a draft*, separately from whether the model produced it. |
| MEASURE 2 — evaluated for trustworthy characteristics | Systems are evaluated | Held-out run 2026-09-15, ruleset 1.4.0, prompt template 1.2.0, `claude-opus-5`: **0 of 70 violations reached a draft**; 4 of 70 produced at the prompt level; the ruleset fired on 34 of 70 | The detectors were frozen at PR #39, so runs since are genuinely held out. The over-blocking is measured and accepted in that direction. |
| MEASURE 3 — tracking mechanisms | Mechanisms for tracking identified risks | The audit record per generation; the results artifact kept by CI; the bead tracker for findings | A deterministic gate test (`tests/unit/evals-gate.test.ts`) proves a weakened rule lets the oracle through, without spending on the model. |
| MEASURE 4 — feedback | Feedback from operators and users | **Thin.** One user, informal channel, and two device checks from session 23 were asked for and never returned | Named here rather than omitted. §8 carries it. |

### MANAGE

| Category | Outcome | Where it lives | Honest assessment |
|---|---|---|---|
| MANAGE 1 — risks prioritised | Risks are prioritised and acted on | `docs/THREAT-MODEL.md` §3's severity column; the tracker's priorities | Severities are one reader's judgement, which the threat model states. |
| MANAGE 2 — strategies to manage | Treatment is planned and resourced | The control set in §6 below; ADRs for deliberate non-treatment | ADR-0004 is the clearest case: a control declined, with the arithmetic shown. |
| MANAGE 3 — third-party risks managed | Third-party risk is managed over time | Pinned actions verified against upstream tags; Dependabot alerts triaged to zero on 2026-10-05; a transitive advisory fixed by hand when Dependabot could not resolve it (`fieldnote-6gq`) | Exercised this session. |
| MANAGE 4 — monitoring and communication | Post-deployment monitoring | **Weak, and structurally so.** The application is local-first and reports nothing: no telemetry, no error reporting, by non-negotiable constraint. Nothing tells the maintainer that anything went wrong on the device. | This is the direct cost of the no-telemetry constraint, and it is the right trade for this system. It should be read as a deliberate exchange, not an oversight: the project gave up monitoring to keep the single-egress claim true. |

---

## 5. ISO/IEC 42001:2023

**Read §1's caveat first.** This project does not hold a copy of the standard. The
structure below reflects the published scheme — management-system clauses 4 to 10 and an
Annex A of controls grouped by objective — at the granularity this map can state
honestly. **Control identifiers are not cited**, because citing a number this document
cannot check against the standard's text would be exactly the overclaiming plan §4.6
warns against. Anyone using this for an audit should map the right-hand column onto the
purchased standard themselves.

**The headline is a negative, and it is the honest one.** ISO/IEC 42001 specifies an AI
*management system*: an organisational apparatus with leadership commitment, defined
roles, competence management, internal audit, and management review. **This project has
no organisation, and therefore does not have an AI management system and could not be
certified against this standard.** Saying that plainly is worth more than a table of
partial credit.

What the standard asks for at the *operational* level, as distinct from the
organisational, is substantially present. That split is the useful result:

| What the standard expects | Present? | Where |
|---|---|---|
| An AI policy, stating principles and constraints | **Yes, in substance** | `CLAUDE.md`'s non-negotiable constraints are a policy in everything but name: they are written down, they bind, and changes have been rejected against them. |
| Defined roles and responsibilities | **Partially** | One maintainer, named, with a published response commitment. There is nobody to separate duties from. |
| Resources and competence management | **No** | No organisation. Not meetable, not claimed. |
| AI system impact assessment | **Yes** | `docs/DATA-PROTECTION.md` is a DPIA-style assessment with the data subjects, inventory, flows, retention, minimisation, rights, processors, and residual risk. `docs/THREAT-MODEL.md` is the adversarial half. |
| Life-cycle management: requirements, design, verification, deployment, operation | **Yes, and traceably** | `docs/PROJECT-PLAN.md` and `docs/BUILD-GUIDE.md` set the sessions; ADRs record design decisions with rejected alternatives; CI verifies; ADR-0012 covers deployment; `docs/HANDOFF.md` carries operating state. |
| Data governance for AI systems | **Yes** | `docs/DATA-PROTECTION.md` §2's field-by-field inventory; the pseudonymization boundary (ADR-0006, ADR-0007); the approved-content library as the only source of claim-bearing text; retention (ADR-0013). |
| Information for interested parties | **Yes, for one party; weak for another** | The deployer is informed thoroughly: `README.md`, the threat model, the assessment, published eval figures. The data subjects are not informed at all, which §4's GOVERN 5 row and `docs/DATA-PROTECTION.md` §6 both state. |
| Responsible use of the AI system | **Yes** | The review gate; no batch generation path; claim-bearing text selected rather than authored; the system never sends. |
| Third-party and supplier relationships | **Yes** | ADRs before dependencies; pinned and verified actions; the provider's retention recorded as fact in `docs/DATA-PROTECTION.md` §7. |
| Internal audit and management review | **No** | No organisation. The nearest equivalents are CI, the handoff regenerated each session, and the fact that the repository is public and inspectable. |
| Continual improvement | **Partially** | Findings become beads and beads become sessions; the changelog records what shipped. There is no cycle anyone outside reviews. |

---

## 6. The control inventory

One table, so this document has a spine. Each row is a control that exists, what holds
it, and which framework expectation it answers. Severity and threat detail stay in
`docs/THREAT-MODEL.md` §3, which this does not duplicate.

| Control | Where it lives | Evidence | Answers |
|---|---|---|---|
| Names do not cross the AI boundary: roster match, structural detection, role references, fail-closed | `src/lib/privacy/pseudonymize.ts`; ADR-0006, ADR-0007 | `tests/unit/pseudonymize.test.ts`, `tests/unit/pipeline.test.ts`, `tests/unit/contacts-boundary.test.ts` | Act Art 10 as it applies here; RMF MAP 5, MANAGE 2; ISO data governance |
| Claim-bearing text is selected from the approved library or blocked, never authored | `src/lib/generation/`; `CLAUDE.md` | `tests/unit/guardrails.test.ts`, `tests/unit/approved.test.ts`, `tests/unit/passages.test.ts`, `tests/unit/evals-gate.test.ts` | Act Art 15; RMF MEASURE 2; ISO responsible use |
| Human review is a state, not a suggestion: export unreachable until a draft is opened | `src/lib/db/`, the draft state machine | `tests/unit/draft-state.test.ts`, `tests/e2e/review.spec.ts` | Act Art 14 and Art 50's editorial-responsibility route; RMF MANAGE 2; ISO responsible use |
| Every generation writes an audit record in the same transaction as its draft | ADR-0008; the repository layer | `tests/unit/repository-drafts.test.ts`, `tests/unit/pipeline.test.ts`, `tests/unit/audit-csv.test.ts` | Act Art 12, voluntarily; RMF MEASURE 3; ISO life cycle |
| Audit records survive the deletion of their event | ADR-0008 | `tests/unit/retention.test.ts`, `tests/e2e/retention.spec.ts` | Act Art 12, voluntarily; RMF MEASURE 3 |
| One egress, and the client points nowhere else | plan §4.1 | `tests/unit/single-egress.test.ts`, `tests/unit/model-call.test.ts`, `connect-src 'self'` in `tests/e2e/headers.spec.ts` | Act Art 15; RMF GOVERN 6, MAP 4; ISO third parties |
| The system never sends: export is clipboard-only into her own mail client | `CLAUDE.md`; ADR-0009, ADR-0011 | `tests/e2e/review.spec.ts`, `tests/e2e/briefing.spec.ts` | Keeps the system out of a different regulatory class entirely; RMF MANAGE 2 |
| No telemetry, no analytics, no error reporting, no third-party scripts or fonts | `CLAUDE.md`; ADR-0012 | `tests/unit/single-egress.test.ts`, `tests/e2e/offline.spec.ts`, `tests/e2e/headers.spec.ts` | Act Art 15; the cost is RMF MANAGE 4, stated there |
| Caller key on the generation route, constant-time, refusing closed when unconfigured | ADR-0012 | `tests/unit/access-key.test.ts`, `tests/unit/access-route.test.ts`, `tests/unit/generate-route.test.ts`, `tests/e2e/access-key.spec.ts` | Act Art 15; RMF MANAGE 2 |
| Content security policy with per-request nonce and `'strict-dynamic'`; no inline script | `src/proxy.ts` | `tests/e2e/headers.spec.ts`, asserted against a live response and against the running deployment | Act Art 15; RMF MANAGE 2 |
| The route logs metadata only, never note or draft content | `src/app/api/generate/route.ts` | `tests/unit/generate-route.test.ts` | Act Art 12's boundary; ISO data governance |
| Retention: an event's content deleted fourteen days after the event, notice from day seven | ADR-0013 | `tests/unit/retention.test.ts` (18 cases), `tests/e2e/retention.spec.ts` | ISO data governance; `docs/DATA-PROTECTION.md` §4 |
| Private terms held out of the public build, loaders report a count and never a term | ADR-0001 | `tests/unit/private-terms.test.ts`, `tests/unit/private-terms-source.test.ts` | ISO data governance; RMF GOVERN 1 |
| No real personal data anywhere, enforced in a pre-commit hook and in CI | ADR-0001; `scripts/check-denylist.mjs` | The hook and the CI step; limits stated in `docs/THREAT-MODEL.md` §6 | RMF GOVERN 1; ISO data governance |
| Guardrails and prompts are versioned, and the version is on every record | `CLAUDE.md` | `tests/unit/schema.test.ts`, the migration tests `migration-v4` through `migration-v9` | Act Art 12; RMF MEASURE 3; ISO life cycle |
| Adversarial eval suite against the live model, gating merges | plan §4.5; `.github/workflows/evals.yml` | `tests/evals/`, `tests/unit/evals-gate.test.ts`, `tests/unit/evals-gating.test.ts` | Act Art 15; RMF MEASURE 1 and 2 |
| Required status checks cannot be unwired by a job rename | `tests/unit/required-checks.test.ts` | The test, plus branch protection read from the API | RMF GOVERN 1; ISO life cycle |
| Dependencies get a record before they are installed; actions pinned by SHA and verified | ADR-0003, ADR-0010 | The pins in all three workflows; `--frozen-lockfile` | RMF GOVERN 6, MANAGE 3; ISO third parties |
| The encryption seam exists and refuses a value it cannot round-trip | ADR-0004 | `tests/unit/cipher.test.ts` | Mapped as a **seam**, not as encryption at rest. See §7. |

Current state of the suites behind this table: **385 unit tests and 52 end-to-end tests,
all passing** on `main` at `ce16360`.

---

## 7. What is deliberately not built

A compliance map that omits these would be the decorative kind. Each is a control a
framework might expect, which this system does not have, with the record that decided it.

**Encryption at rest.** ADR-0004. The seam is built and tested; the cryptography is
deferred to the private fork's session 19. The record's own threat table shows the
control closing one row of five, and that row conditional on a passphrase not being
cached, against a permanent data-loss path in the workflow the project exists to make
reliable. **Map it as a seam, cite the record, and do not describe encryption at rest as
implemented.** The residual — data at rest protected by full-disk encryption and the
browser's origin isolation and nothing else — is in `docs/THREAT-MODEL.md` §6.

**Audio capture and transcription.** ADR-0005. Declined because a transcription call
would be a second egress and the single-egress claim is the strongest thing in the
repository. Device dictation only; where the platform runs it is recorded as unverified
(`fieldnote-8w6`).

**Accounts and authentication of the human.** `SECURITY.md` says so. There are no
accounts; the device's lock is the control, and the application neither enforces nor
detects it (`fieldnote-m8t`). ADR-0012 added a caller key for the *route*, which
authenticates a device to the API and not a person to the application.

**A machine-readable marker on exported text.** §3.3. The gap under Article 50's
synthetic-content marking duty, recorded as `fieldnote-lr8`.

**Post-deployment monitoring.** §4, MANAGE 4. Given up deliberately to keep the
no-telemetry constraint true.

**A channel for data subjects.** §4, GOVERN 5, and `docs/DATA-PROTECTION.md` §6. The
attendees do not know the store exists and have no way to reach it.

**An AI management system.** §5. No organisation, therefore no certifiable AIMS.

---

## 8. Known gaps in this map

Stated rather than smoothed over, in the manner of the documents this one draws on.

- **Two of the three standards were mapped from their published structure, not from an
  authoritative copy read while writing.** NIST AI RMF 1.0 is free and its four
  functions and categories are stable and well known. The EU AI Act is free in the
  Official Journal and its Article numbers are cited here with reasonable confidence.
  **ISO/IEC 42001:2023 is paywalled and this project does not hold it**, which is why §5
  cites no control identifiers at all. Treat §5 as an honest self-assessment against the
  standard's shape, not as a clause-by-clause mapping.
- **The EU AI Act's territorial application to this system is unestablished.** §2 maps
  as if it applied. Whether it does depends on where the private fork runs and where the
  representative works, and this repository knows neither.
- **The provider-and-deployer assignment in §2 is this map's reading, not a legal
  opinion.** It is argued from the Act's definitions and could be wrong, particularly for
  the public build, where the free-and-open-source exclusion's edges are not something
  this document can settle.
- **Nobody with a compliance qualification has read this.** It is an engineer's mapping,
  written to the standard plan §4.6 sets, and its value is that every row points at a
  test or a record you can check yourself.
- **The eval figures are one held-out run on one day**, 2026-09-15, at five samples per
  case. §4's MEASURE rows carry that. `README.md`'s prose for that run currently
  disagrees with `README.md`'s own table about how many violations the model produced;
  this map cites the table, whose per-class rows sum to the figure it reports, and the
  discrepancy is `fieldnote-12k`.
- **Several controls in §6 are verified in a test browser and not on the device.**
  Retention has never run on real hardware. Session 23's device checks were asked for and
  never returned.
- **The private fork is invisible from here** (`fieldnote-v2s`), so every row whose real
  behaviour depends on it is a claim about the public build only.
- **This map will go stale.** It is correct for `main` at `ce16360` on 2026-10-05. A
  control added or removed after that date is not in it, and the threat model and the
  assessment are the sources to re-read, not this file.
