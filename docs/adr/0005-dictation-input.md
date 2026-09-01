# ADR-0005: Device dictation only; no audio capture, storage, or transcription

- **Status:** Accepted
- **Date:** 2026-09-01
- **Deciders:** cp48isme (owner)

## Context

Capture happens standing up, in a parking lot, between conversations, often with hands
occupied. Dictation is not a convenience feature here — for a meaningful share of notes it
is the only realistic input method, and the prototype test confirmed it.

Three implementations are available:

1. **Device dictation.** The representative taps the microphone on the iOS or Android
   keyboard. The operating system transcribes; the application receives text in a textarea
   and never knows dictation was used.
2. **In-app recording with API transcription.** The application requests microphone
   permission, records audio, and posts it to a speech-to-text service.
3. **In-app recording retained locally.** As above, but audio is stored on the device
   alongside the note, as a reference recording.

Option 1 was the prototype's behaviour, arrived at by default rather than by decision. It
is worth deciding deliberately, because options 2 and 3 both introduce a new class of data
into a system whose entire compliance argument is built on what it does not hold.

The decisive consideration is project plan §4.1. That section claims — and the architecture
is built to make true — that **the model API call is the only egress from this system**,
and that identity does not cross it. A transcription service is a second egress, carrying
the representative's voice describing named physicians, before any pseudonymization has
occurred. It would not weaken §4.1's claim; it would falsify it.

There is a data-protection dimension beyond egress. An audio recording of a representative
describing a named surgeon is a richer and more sensitive artifact than the text of the
same note: it carries tone, hesitation, aside remarks, and whatever else was audible in the
room. Under GDPR, voice recordings are not automatically special-category data — that
characterization attaches when the recording is processed for the purpose of uniquely
identifying a person, which is not the purpose here. But the position is contestable rather
than settled, it varies by jurisdiction, and per plan §4.6 this project's stance is to be
precise rather than expansive. The cleanest way to be precise about audio retention risk is
not to retain audio.

Retention interacts with plan §2 as well. Business records held on personal infrastructure
are already the second-most-serious issue in that section. Audio recordings of a
representative discussing physicians would be the worst possible instance of it.

## Decision

**Device dictation only.**

- The application requests no microphone permission.
- No audio is recorded, transmitted, or stored at any point.
- No transcription service is integrated, and no dependency capable of one is added.
- Dictated input is indistinguishable from typed input at the application boundary. It
  arrives as text in a textarea.

**Dictated text is treated as untrusted input**, on the same footing as an imported roster
file (ADR-0003). The representative does not compose it character by character and will not
reliably proofread it in the field; whatever the operating system heard, correctly or
otherwise, is what reaches the note. It therefore crosses the pseudonymization boundary
(§4.1) and the guardrails (§4.5) as hostile, and prompt injection via dictated input is a
first-class entry in the threat model (session 15) rather than a footnote.

## Alternatives considered

**In-app recording with API transcription.** Better accuracy than OS dictation, particularly
for surgical terminology, and control over the transcription prompt.

Rejected. It creates a second egress path and defeats the single-boundary claim in §4.1,
which is the strongest thing in the repository. It introduces a second processor handling
content about identifiable healthcare professionals, requiring its own retention and
sub-processor analysis. The accuracy gain is real but bounded, and it is offset by the fact
that a mis-transcribed name is caught at review (§4.3) regardless of which engine produced
it — the human is in the loop for exactly this.

**In-app recording retained locally, never transmitted.** No egress, no processor, and the
representative can replay a note she cannot parse.

Rejected. The egress argument does not apply, but the retention one does, and it is
sufficient on its own: audio of a representative describing named physicians, held on
personal infrastructure, is a materially worse artifact to hold than the text, and it is
held in service of an edge case — a note so mangled it cannot be read. The remedy for that
note is to write it again, which takes fifteen seconds.

**Web Speech API in-browser.** Rejected without extended analysis. On the target platforms
it delegates to a cloud service in most implementations, which is option 2 with the egress
obscured rather than removed. Support is inconsistent, and the failure mode — silently
transmitting audio the developer believed was processed locally — is exactly the kind of
thing this repository should not ship.

## Consequences

**Positive**

- §4.1's single-egress claim remains literally true and defensible under inspection.
- No microphone permission prompt, which is one less thing to explain and one less
  capability to hold.
- No audio retention question in the DPIA (session 16), because there is no audio.
- Zero implementation cost: the decision is to build nothing.

**Negative**

- Transcription quality is entirely outside the system's control, and cannot be improved by
  prompt work, vocabulary hinting, or model choice. OS dictation handles surgical
  terminology and surnames poorly, and there is no recourse.
- There is no source recording to re-transcribe when text is mangled. A badly captured note
  is lost as captured; the representative must rewrite it from memory.
- Dictation artifacts become a real burden on downstream sessions rather than an edge case:
  session 3's capture UI must be comfortable to correct text in, and session 4's
  pseudonymization must tokenize names that arrive misspelled, phoneticized, or split
  across words. A tokenizer that only matches clean spellings will leak on dictated input.

**Consequences for the corpus**

Sessions 4, 7, and 15 all depend on knowing what device dictation actually produces:
run-on sentences with no punctuation, literal "period" and "new paragraph" landing as
words, homophones, phoneticized surgical terms, false starts and mid-sentence
self-corrections. Synthetic examples of these are reliably too tidy to be useful test
material.

Six to ten genuinely uncorrected dictated notes from the representative are therefore a
project input, recorded in plan §7 alongside the writing samples. They are private-fork
material; where they are adapted into public eval cases, names are replaced with the
synthetic roster per ADR-0001.
