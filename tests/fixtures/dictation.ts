/**
 * Dictation fixtures for the pseudonymization boundary.
 *
 * PROVENANCE IS PER CASE AND IS NOT DECORATION. The build guide says to write the
 * dictation cases from the real dictated notes rather than inventing them, because
 * invented dictation artifacts are always too tidy. That is right about the artifacts and
 * impossible for the names: the real corpus (plan §7 item 2, `private/`) refers to every
 * person by an initial or a role and contains no surnames at all, so there is nothing in
 * it for a mangled surname to be mangled *from*. A fixture claiming otherwise would be
 * false, so each case says where it came from:
 *
 *   - `observed`    — a real dictation artifact, seen happening.
 *   - `adapted`     — shape taken from the real corpus, every identifying and commercial
 *                     term substituted before it reached this file.
 *   - `constructed` — invented to cover a class the available evidence does not contain.
 *
 * WHAT WAS SUBSTITUTED, AND WHY IT IS MORE THAN NAMES. Per plan §7 as amended, adapting
 * this material replaces names *and* product and commercial detail — product
 * characteristics, competitive pricing comparisons, regulatory indication status. Each of
 * those names the manufacturer to anyone working in the field with every personal name
 * already removed, and each is the employer's commercial information in its own right
 * rather than personal data that de-identification would address. The device category
 * itself is substituted for the same reason: a console, arms, a camera port and a stapler
 * together identify one of about three companies. The clinical setting is not substituted,
 * because the repository already speaks publicly about surgeons and medical devices, and
 * that is not what makes a manufacturer identifiable.
 *
 * WHAT SURVIVED SUBSTITUTION, WHICH IS THE ENTIRE POINT. The artifacts are the signal:
 * run-on sentences with no commas, missing terminal punctuation, homophones (`chords` for
 * cords, `residence` for residents, `four` for for), a compound noun split into two real
 * words, an abandoned clause, and a claim-shaped question. Substituting those would leave
 * a corpus of clean prose testing nothing.
 *
 * All names below are invented. No real physician, staff member, or institution appears,
 * including none taken from a public directory — ADR-0001 has no public-figure exception.
 */

import type { AttendeeRecord } from "@/lib/db";

export type Provenance = "observed" | "adapted" | "constructed";

export interface DictationCase {
  readonly id: string;
  readonly provenance: Provenance;
  /** What this case exists to exercise. */
  readonly covers: string;
  readonly text: string;
}

/** Stamps the base-record fields so fixtures can be real `AttendeeRecord`s. */
function attendee(
  id: string,
  displayName: string,
  role: string,
  specialty: string,
): AttendeeRecord {
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 1,
    eventId: "event-fixture",
    displayName,
    role,
    specialty,
    institution: "Northgate Regional",
  };
}

/**
 * The synthetic roster. Invented, per ADR-0001.
 *
 * Two Vances are deliberate: the build guide names "a surgeon who shares a surname with a
 * staff member" as a case the tokenizer has to survive. `Green` is deliberate too — it is
 * a surname that is also an ordinary word, which has to tokenize after a title and stay
 * untouched in "the green light on the console".
 */
export const ROSTER: readonly AttendeeRecord[] = [
  attendee("att-1", "Dr. Amara Okonjo-Baptiste", "Consultant", "Colorectal"),
  attendee("att-2", "Dr. Peter Vance", "Consultant", "Upper GI"),
  attendee("att-3", "Marisol Vance", "Theatre coordinator", ""),
  attendee("att-4", "Dr. Ruth Green", "Registrar", "General"),
  attendee("att-5", "Tomas Piper", "Biomedical engineer", ""),
];

/**
 * Adapted from the real corpus. Seven notes, one per source note, in source order.
 *
 * Every person in the source was an initial or a role, and that is preserved: it is the
 * honest shape of the material and it is also why `ROLE_REFERENCE` below is a known gap
 * rather than a solved case.
 */
export const ADAPTED_NOTES: readonly DictationCase[] = [
  {
    id: "adapted-1",
    provenance: "adapted",
    covers: "run-on with no internal punctuation; title plus bare initial",
    text: "Dr A spent about 25 minutes on the truck really likes the open control panel and the sensor set as well as the display but has concerns around the probe port size as well as the lack of a sealer. He is interested in a live case observation.",
  },
  {
    id: "adapted-2",
    provenance: "adapted",
    covers: "role reference with no name; homophone 'chords' for cords",
    text: "Clinical Engineering Lead really likes that each piece is modular and can fit in multiple locations throughout the OR. Also appreciative of the fact that the heads are interchangeable. Has concerns about the number of chords, but I communicated that we have a good cable management system. They asked about what size room the system can fit in and so I explained that it is meant to be used and moved across multiple rooms.",
  },
  {
    id: "adapted-3",
    provenance: "adapted",
    covers: "role reference; abandoned clause mid-sentence; pricing comparison",
    text: "The director of finance and procurement liked the flexibility of our purchase models as well as the tooling kit and stocked-inventory pricing. They did have concerns around the service cost, but I explained with our support model they need for a higher service cost as well as having a local engineer. Discussed total cost of ownership at about a 15% reduction from the alternative.",
  },
  {
    id: "adapted-4",
    provenance: "adapted",
    covers:
      "compound noun split into two real words ('multi plier'); no terminal punctuation",
    text: "Dr. R said that he can easily achieve multi position access due to the layout of the system and stay closer to his traditional manual set up. The limiting factors are the size of the probe port as well as the lack of a hub and signal multi plier. Currently doing bedside sealing so lack of a powered sealer is not a concern. Cannot do anything further until we receive extended-use indication",
  },
  {
    id: "adapted-5",
    provenance: "adapted",
    covers: "title plus bare initial with a period",
    text: "Dr. K was definitely lukewarm on the system. Sees it as a step back from his current system and has concerns around the staff needing to learn a brand new system. Had questions around mounting time as well as cost of change.",
  },
  {
    id: "adapted-6",
    provenance: "adapted",
    covers: "role reference only, no name anywhere in the note",
    text: "The chief executive appreciated the engagement and opportunity to get hands-on. Was curious about the feedback from the surgeons. Recognizes this option as a cost benefit to the hospital but is going to rely on the surgeons to drive this process.",
  },
  {
    id: "adapted-7",
    provenance: "adapted",
    covers: "homophones 'four' for for and 'residence' for residents",
    text: "The training coordinator really liked the open control panel as well as the planning module part four prepping four cases as well as post case analytics. They had concerns about the lack of a second control panel for training purposes, but also see the benefit in having residence trained on multiple systems.",
  },
];

/**
 * The one real mangling anybody has observed.
 *
 * From a phone dictation test: the speaker said Swali, the device produced Swelha. Same
 * initial consonant, different length, different vowels. No edit-distance or phonetic
 * matcher tuned tightly enough to avoid firing on ordinary prose recovers that, which is
 * precisely why the tokenizer has a structural rule instead of a fuzzy one.
 *
 * The sample it came from is five dictated surnames: one mangled this severely, four
 * transcribed correctly. That is worth stating because it inverts the usual framing.
 * Mangling is rare, not constant — so nobody is watching for it — and severe, not mild —
 * so nothing approximate catches it.
 */
export const OBSERVED_MANGLING = {
  spoken: "Swali",
  transcribed: "Swelha",
} as const;

export const OBSERVED_CASES: readonly DictationCase[] = [
  {
    id: "observed-1",
    provenance: "observed",
    covers:
      "severe mangling of a surname that is on no roster; only the title marks it as a name",
    text: `Spoke with Dr. ${OBSERVED_MANGLING.transcribed} about the mounting time and he wants a second look before committing.`,
  },
];

/**
 * Classes the evidence does not contain, invented and labelled as such.
 *
 * The common-noun surnames cut both ways on purpose: `Dr. Green` has to tokenize while
 * "the green light on the console" has to be left completely alone. A tokenizer that gets
 * only one of those directions right is not usable.
 */
export const CONSTRUCTED_CASES: readonly DictationCase[] = [
  {
    id: "constructed-transposed",
    provenance: "constructed",
    covers: "transposed letters in a roster name, so roster matching misses it",
    text: "Dr. Oknojo-Baptiste asked whether the heads can be swapped mid-session.",
  },
  {
    id: "constructed-fragment",
    provenance: "constructed",
    covers: "a name the device rendered as an unpronounceable fragment",
    text: "Dr. Vskez wanted the tooling kit costed separately.",
  },
  {
    id: "constructed-common-noun-name",
    provenance: "constructed",
    covers: "surname that is also an ordinary word, used as a name",
    text: "Dr. Green confirmed the trial dates and Piper is chasing the paperwork.",
  },
  {
    id: "constructed-common-noun-not-name",
    provenance: "constructed",
    covers: "the same words used as ordinary words, which must not tokenize",
    text: "The green light on the console stays on and we came back to Rome on the Tuesday with an orange cable.",
  },
  {
    id: "constructed-possessive",
    provenance: "constructed",
    covers: "possessive and initials inside prose",
    text: "Dr. Okonjo-Baptiste's registrar and A. Okonjo-Baptiste both asked about the probe port.",
  },
  {
    id: "constructed-shared-surname",
    provenance: "constructed",
    covers: "a surgeon and a staff member sharing a surname",
    text: "Vance is happy with the layout but Vance on the coordination side wants more notice.",
  },
  {
    id: "constructed-lowercase-title",
    provenance: "constructed",
    covers: "dictation that did not capitalise the title",
    text: "spoke to dr swali again about the fastening and he is still keen",
  },
  {
    id: "constructed-title-as-noun",
    provenance: "constructed",
    covers: "'doctor' as an ordinary noun, which must not tokenize the next word",
    text: "the doctor said the room was too small and the doctor recommended we come back.",
  },
];

export const ALL_CASES: readonly DictationCase[] = [
  ...ADAPTED_NOTES,
  ...OBSERVED_CASES,
  ...CONSTRUCTED_CASES,
];
