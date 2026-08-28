# Security Policy

## Reporting a vulnerability

Report privately through GitHub's private vulnerability reporting:

**https://github.com/cp48isme/fieldnote/security/advisories/new**

Please do not open a public issue for a suspected vulnerability, and do not include
real personal data in a report — see [What not to send](#what-not-to-send) below.

Expect an acknowledgement within 7 days and an assessment within 30. This is a
personal project maintained in evenings, not a staffed product, and that timeline is
what one maintainer can honestly commit to rather than an aspiration.

If a report is valid I will fix it, credit you in `CHANGELOG.md` unless you prefer
otherwise, and publish an advisory. If I disagree that something is a vulnerability I
will say so and explain why rather than letting the report go quiet.

## What this application is, for triage purposes

Understanding the architecture will save you time, because it rules out whole classes
of finding.

This is a **local-first** progressive web app. It holds **no server-side user data**.
There is no user database, no accounts, no sessions, no server-side storage of
attendee records. Everything a user captures lives in IndexedDB in their own browser,
on their own device.

The application has exactly one network egress path: a server-side route handler that
forwards pseudonymized text to the Anthropic API. Names are replaced with stable
tokens client-side before that call and rehydrated locally afterwards, so personal
names are not present in the request. The route is a stateless pass-through and logs
metadata only, never note or draft content.

The system never sends email. Export is clipboard-only, into the user's own mail
client. There is no SMTP, no mail API, no scheduled sending.

There is no analytics, telemetry, error-reporting service, or third-party script.

## In scope

- Bypasses of the pseudonymization boundary — any path by which an unpseudonymized
  name, or other identifying data, could reach the model API
- Prompt injection reaching a privileged action, including injection carried in
  dictated or imported content
- Bypasses of the approved-content constraint on claim-bearing text
- Bypasses of the human review gate on export
- Audit record tampering, omission, or forgery
- Secret exposure: an API key reaching the client bundle, a log, or the repository
- Local data-at-rest weaknesses, including the WebCrypto envelope encryption
- Dependency vulnerabilities with a demonstrated path to exploitation here
- Standard web vulnerabilities: XSS, CSRF, SSRF, path traversal, injection

## Out of scope

- Vulnerabilities in the Anthropic API itself — report those to Anthropic
- Attacks requiring physical access to an unlocked device, or a compromised browser
  or operating system
- Missing hardening headers with no demonstrated impact
- Automated scanner output submitted without a working proof of concept
- Social engineering of the maintainer
- Denial of service against a static, single-user, local-first application
- Model output quality: a hallucination, an awkward draft, or an unhelpful response is
  a bug, not a vulnerability. Report it as an issue. Model output that **defeats a
  governance control** — an unapproved product claim rendering rather than being
  blocked — is in scope and belongs here.

## What not to send

Do not include real personal data in a vulnerability report. This project exists in
part to keep identifying information out of systems that do not need it, and a report
is one of those systems.

If you need to demonstrate a finding with data, use synthetic values. If a real value
is genuinely load-bearing to the proof, say so and describe its shape without pasting
it, and we will find a way to reproduce it that does not put it in a GitHub advisory.

Reports containing real personal data will be acted on and then redacted.

## Supported versions

Pre-1.0 and under active development. Only `main` is supported; there are no
maintained release branches. Fixes land on `main`.

## A note on this repository

This is the public, de-branded reference build. Its example data is synthetic and
deliberately obviously so. It contains no real manufacturer, product, institution, or
person, and it is not a deployment of anyone's production system. See `docs/adr/`,
ADR-0001, for why the project is structured this way.
