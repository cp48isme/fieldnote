# ADR-0001: De-branded public build, private fork for production use

- **Status:** Accepted
- **Date:** 2026-08-27
- **Deciders:** cp48isme (owner)

## Context

This system serves two purposes that impose conflicting requirements.

The first is operational: a field representative for a medical device manufacturer
needs to capture attendee interactions at mobile demonstration events and produce
personalized follow-up correspondence. This requires real branding, a real writing
voice, and data about identifiable healthcare professionals.

The second is demonstrative: the repository is intended as a public reference
implementation of AI governance practice in a regulated domain, and must therefore be
open, inspectable, and durable.

Satisfying both in a single public repository creates four distinct exposures:

1. **Trademark.** Use of a manufacturer's marks and product names in a public
   repository, by someone with no license to use them, in a project that describes
   their commercial process.
2. **Confidentiality.** A representative's event workflow, territory structure, and
   messaging approach are the employer's commercial information, whether or not
   formally designated confidential.
3. **Records and discoverability.** Correspondence between a manufacturer's
   representative and healthcare professionals constitutes a business record. Retaining
   drafts or metadata in a repository outside the employer's control impairs their
   ability to preserve, search, or produce those records.
4. **Personal data.** Names, specialties, institutional affiliations, clinical
   interests, and procurement influence of identifiable physicians, assembled without
   their knowledge and held on personal infrastructure.

None of these are hypothetical, and none are resolved by a disclaimer in a README.

## Decision

One codebase, two configurations.

**The public build** is generic and unbranded. The domain is described as "field
representatives running demonstration events for regulated products." All seed and
fixture data is synthetic, describing a fictional company and fictional attendees. No
manufacturer name, product name, or real individual appears anywhere in the repository
or its history. This build is the reference implementation and the public artifact.

**The private build** is a private fork carrying real configuration: branding, voice
profile, approved content, and event data. It is never public and never indexed. It is
not deployed for production use until the organizational review described in the
project plan §2 has concluded.

Branding, voice profile, and approved content are configuration inputs loaded at
runtime, not compiled artifacts. The two builds differ only in configuration and
fixtures.

## Consequences

**Positive**

- Eliminates the trademark and confidentiality exposure entirely rather than
  mitigating it.
- No personal data of any real physician enters version control.
- Public work proceeds immediately, independent of the organizational review.
- The generic framing is a stronger demonstrative artifact: it presents a system
  designed for a regulated problem class rather than a single individual's job.
- Forces branding and voice to be configuration rather than hardcoded, which is better
  architecture regardless.

**Negative**

- Two configurations to maintain, and a fork that will drift.
- Demonstrations require synthetic data convincing enough to show real capability.
- Contributors to the public build cannot see the production configuration, which
  complicates reproducing configuration-specific defects.

**Mitigations**

- The private fork tracks public `main` and carries configuration only — no divergent
  feature code. Any fix originates in the public build.
- Secret scanning with push protection, plus a pre-commit hook, enforce the
  no-real-data rule mechanically rather than by discipline.
- Synthetic fixtures are maintained as a first-class asset with the same care as
  production configuration.

## Alternatives considered

**Single private repository.** Satisfies the operational goal, forfeits the
demonstrative one entirely. Rejected.

**Single public repository with real branding.** Rejected on all four exposures above.

**Public repository with branding stripped at commit time via filters.** Rejected as
fragile: a filter that fails once puts data in immutable history, and the failure is
discovered after the fact rather than before.
