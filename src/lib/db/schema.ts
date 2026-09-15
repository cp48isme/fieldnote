/**
 * Entity types and per-field encryption classification.
 *
 * Per ADR-0004 and plan §5 non-negotiable 7, every field is classified as
 * encryption-eligible or clear, and the classification lives beside the type rather
 * than in a separate list. `FieldPolicies<T>` is a mapped type over `Required<T>`, so
 * adding a field to an entity without classifying it is a type error, not a drift that
 * surfaces months later. `pnpm typecheck` is what enforces this.
 *
 * Classification line, per the session brief: anything carrying attendee identity or
 * note content is eligible; ids, timestamps, schema versions, and enum state fields are
 * not. Where a field was a judgement call, the `why` says so — the point of recording
 * it at schema-definition time is that the reasoning is available later.
 */

export type Id = string;

/** Bumped by a migration in `migrations.ts`. Stamped onto every record on write. */
export const CURRENT_SCHEMA_VERSION = 7;

export type EncryptionClass =
  /** Encrypted at rest once session 19 replaces the identity cipher. */
  | "eligible"
  /** Stored in the clear. Required for indexing, or carries no identity. */
  | "clear";

/**
 * What an encryption-eligible field holds, so the cipher knows which of its two
 * transforms applies and can refuse the other. Session 11 added `bytes` for images; a
 * policy that omits `shape` is a string field, so nothing written before then changed.
 */
export type FieldShape = "string" | "bytes";

export interface FieldPolicy {
  encryption: EncryptionClass;
  /** Defaults to `string`. Meaningful only for eligible fields; a clear field is stored as is. */
  shape?: FieldShape;
  why: string;
}

/**
 * Every field of T must appear. `Required<T>` means optional fields are classified too
 * — an optional field still holds data when present.
 */
export type FieldPolicies<T> = { [K in keyof Required<T>]: FieldPolicy };

/** Fields carried by every record, per plan §5. */
export interface BaseRecord {
  id: Id;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

const BASE_POLICY: FieldPolicies<BaseRecord> = {
  id: { encryption: "clear", why: "Opaque UUID; primary key, must be indexable." },
  createdAt: { encryption: "clear", why: "Timestamp; carries no identity." },
  updatedAt: { encryption: "clear", why: "Timestamp; carries no identity." },
  schemaVersion: {
    encryption: "clear",
    why: "Migration machinery must read this without a key.",
  },
};

// --- Event -----------------------------------------------------------------

export type EventStatus = "planned" | "active" | "closed";

export interface EventRecord extends BaseRecord {
  name: string;
  siteLabel: string;
  startsAt: number | null;
  status: EventStatus;
  /**
   * The dossier (plan §3.2, session 11): what the briefing says about the event itself,
   * entered by the representative and laid out as written (ADR-0009). Five free-text
   * fields on the event rather than a table, because they are plainly event data. Empty
   * strings until she fills them; the briefing omits an empty one.
   */
  objectives: string;
  configuration: string;
  itinerary: string;
  logistics: string;
  contingency: string;
  /**
   * Where the event actually is (plan §3.3, session 12). `address` is the street address
   * as she would give it; `coordinates` is one string, "lat, lng", validated on entry to
   * two decimal numbers in range (`src/lib/location/coordinates.ts`). One string rather
   * than two numbers so the cipher keeps two shapes. Coordinates matter more than the
   * address: a truck in a parking lot is not at the building's street address, and the
   * map links in the pre-event email are built from these.
   */
  address: string;
  coordinates: string;
}

export const EVENT_POLICIES: FieldPolicies<EventRecord> = {
  ...BASE_POLICY,
  name: {
    encryption: "eligible",
    why: "Judgement call: an event name in the private fork routinely contains an institution or a town, which identifies indirectly.",
  },
  siteLabel: {
    encryption: "eligible",
    why: "Location of a real site; identifying in combination with the date.",
  },
  startsAt: { encryption: "clear", why: "Timestamp; needed for sorting events." },
  status: { encryption: "clear", why: "Enum state; drives queries, no identity." },
  objectives: {
    encryption: "eligible",
    why: "Free text about a real account's event; names what the visit is for.",
  },
  configuration: {
    encryption: "eligible",
    why: "Free text; the room, the equipment, the site — identifying in combination.",
  },
  itinerary: {
    encryption: "eligible",
    why: "Free text; times and places at a real site on a real date.",
  },
  logistics: {
    encryption: "eligible",
    why: "Free text; addresses, parking, access — a location record.",
  },
  contingency: {
    encryption: "eligible",
    why: "Free text; may name people to call and where to go.",
  },
  address: {
    encryption: "eligible",
    why: "A real site's street address; identifying in combination with the date.",
  },
  coordinates: {
    encryption: "eligible",
    why: "A location to a few metres, kept as one string so the seam's shapes stay two.",
  },
};

// --- Attendee --------------------------------------------------------------

/**
 * Where an attendee record came from. `captured` is the dock's add-person flow — someone
 * the representative met and typed in during the event. `imported` is a row from a
 * sign-in sheet or registration list (session 8). The roster is an intention, not a
 * record (`fieldnote-g7d`): the briefing must say who was expected, the review surface
 * can tell a person met from a person listed, and ADR-0006's residual risk — a name with
 * neither a title nor a roster entry — is worse after import, so the record says which
 * entries were seen and which were assumed. Follows `NoteRecord.source`.
 */
export type AttendeeSource = "captured" | "imported";

/**
 * Which of plan §4.1's two token classes a person belongs to: an HCP — a clinician, the
 * `[HCP_n]` token — or staff, `[STAFF_n]`. The plan's own words, and the tokenizer's.
 *
 * A field since v4 (session 10). Until then the pseudonymizer read the class off whether
 * `specialty` was non-empty, which was true of clinicians only while the dock was the
 * only writer; session 8's import fills `specialty` from a sheet, and a "Department"
 * column made the heuristic decide whether the model was told "a clinician" or "a
 * colleague" (`fieldnote-1o6`). The dock writes `staff`; import writes `hcp` when the
 * mapped title column reads Dr or Prof; the attendee view lets it be corrected.
 */
export type AttendeeKind = "hcp" | "staff";

export interface AttendeeRecord extends BaseRecord {
  eventId: Id;
  displayName: string;
  kind: AttendeeKind;
  role: string;
  specialty: string;
  institution: string;
  source: AttendeeSource;
  /**
   * What the representative writes about this person for the briefing (session 11):
   * her opener, her talking points, in her words — ADR-0009 withdrew the model from
   * both. Shown in the briefing and nowhere else; never sent to a model. The dictated
   * notes are a different thing and stay out of the briefing.
   */
  briefingNotes: string;
}

export const ATTENDEE_POLICIES: FieldPolicies<AttendeeRecord> = {
  ...BASE_POLICY,
  eventId: { encryption: "clear", why: "Foreign key; must be indexable." },
  displayName: { encryption: "eligible", why: "Directly identifying." },
  kind: {
    encryption: "clear",
    why: "Enum; the token class the pseudonymizer issues. No identity in it, like source.",
  },
  role: {
    encryption: "eligible",
    why: "Judgement call: a role is not identifying alone, but is identifying alongside institution in a small department.",
  },
  specialty: {
    encryption: "eligible",
    why: "Same reasoning as role; a specialty plus an institution narrows sharply.",
  },
  institution: { encryption: "eligible", why: "Directly identifying in combination." },
  source: {
    encryption: "clear",
    why: "Enum; records how the record arrived, met or listed. No identity in it.",
  },
  briefingNotes: {
    encryption: "eligible",
    why: "Free text about a named person, written for an internal document.",
  },
};

// --- Image -----------------------------------------------------------------

/**
 * What an image is for. `attendee-photo` is the one this build writes (session 11), one
 * per attendee, replaced on re-upload. `site-map` exists now so session 12's map lands in
 * this table without another migration; nothing writes it yet.
 */
export type ImagePurpose = "attendee-photo" | "site-map";

/**
 * A stored image: bytes, never a `Blob`. The cipher's second shape (ADR-0004 as amended
 * 2026-09-15): a real cipher emits bytes, so the stored type is the emitted type, and
 * nothing depends on a `Blob` surviving IndexedDB on Safari. `ownerId` is the attendee
 * (or, for a site map, the event); an owner's images go when the owner goes. Photos are
 * resized on the device before they get here — longest edge 512 pixels, JPEG — because a
 * phone camera produces four-megabyte files and a briefing needs a thumbnail. Uploaded
 * by the representative, never fetched (plan §3.2).
 */
export interface ImageRecord extends BaseRecord {
  ownerId: Id;
  purpose: ImagePurpose;
  bytes: ArrayBuffer;
  mediaType: string;
  width: number;
  height: number;
}

export const IMAGE_POLICIES: FieldPolicies<ImageRecord> = {
  ...BASE_POLICY,
  ownerId: { encryption: "clear", why: "Foreign key; must be indexable." },
  purpose: {
    encryption: "clear",
    why: "Enum; what the image is for. No identity in it.",
  },
  bytes: {
    encryption: "eligible",
    shape: "bytes",
    why: "A photograph of a named person: directly identifying, and the only binary in the store.",
  },
  mediaType: {
    encryption: "clear",
    why: "A media type is not identity; the layout needs it before decoding anything.",
  },
  width: {
    encryption: "clear",
    why: "Pixel dimension; no identity. Sizes the layout without decoding.",
  },
  height: {
    encryption: "clear",
    why: "Pixel dimension; no identity. Sizes the layout without decoding.",
  },
};

// --- Contact ---------------------------------------------------------------

/**
 * A person on the briefing who is not an attendee (session 11, `fieldnote-g7d`'s second
 * class of person): the representative's own team, the site coordinator, the truck
 * operator, transportation. Plan §3.2's contact cards and staffing roles.
 *
 * A CONTACT NEVER ENTERS A MODEL CALL AND THE PSEUDONYMIZER NEVER SEES ONE. Contacts are
 * not attendees: no follow-up is drafted to them, no token is issued for them, and the
 * generation layer has no way to reach this table — `tests/unit/contacts-boundary.test.ts`
 * fails the build if anything under `src/lib/generation/` names it. They exist for one
 * document, laid out from what she typed (ADR-0009).
 */
export interface ContactRecord extends BaseRecord {
  eventId: Id;
  name: string;
  /** What they do at the event: "site coordinator", "truck operator". */
  function: string;
  phone: string;
  email: string;
  notes: string;
}

export const CONTACT_POLICIES: FieldPolicies<ContactRecord> = {
  ...BASE_POLICY,
  eventId: { encryption: "clear", why: "Foreign key; must be indexable." },
  name: { encryption: "eligible", why: "Directly identifying." },
  function: {
    encryption: "eligible",
    why: "A function at a named site narrows to one person; and it is free text she wrote.",
  },
  phone: { encryption: "eligible", why: "Directly identifying contact detail." },
  email: { encryption: "eligible", why: "Directly identifying contact detail." },
  notes: { encryption: "eligible", why: "Free text about a real person." },
};

// --- Note ------------------------------------------------------------------

export type NoteSource = "typed" | "dictated";

export interface NoteRecord extends BaseRecord {
  eventId: Id;
  /**
   * Null when a note is captured before the person is identified. See the header of
   * `repository.ts` for why this is nullable rather than a placeholder attendee.
   */
  attendeeId: Id | null;
  body: string;
  /** Per ADR-0005 this records how text arrived, never any audio. */
  source: NoteSource;
}

export const NOTE_POLICIES: FieldPolicies<NoteRecord> = {
  ...BASE_POLICY,
  eventId: { encryption: "clear", why: "Foreign key; must be indexable." },
  attendeeId: { encryption: "clear", why: "Opaque foreign key; must be indexable." },
  body: {
    encryption: "eligible",
    why: "Free text about a real interaction; the most sensitive field in the store.",
  },
  source: {
    encryption: "clear",
    why: "Enum; records how text arrived, never any audio (ADR-0005).",
  },
};

// --- Draft -----------------------------------------------------------------

/**
 * Per plan §4.3 and CLAUDE.md, export is gated on a human opening the draft:
 * `generated` → `reviewed` → `exported`. `blocked` is the fourth state, added in v2: a
 * generation the pipeline withheld — a refusal, a truncation, a hallucinated name — is
 * persisted with its reason so that its audit record has something to point at, and it
 * has no outgoing transition at all. The transition table is `draft-state.ts`.
 */
export type DraftState = "generated" | "reviewed" | "exported" | "blocked";

/**
 * Why a draft was withheld. Defined here rather than in the pipeline because the schema
 * is the lower layer: the pipeline re-exports it. `truncated` and `refusal` are the
 * model's stop reasons; `request-failed` is the route unreachable; `defect` is the
 * tokenizer's own invariant failing on input; `output-blocked` is the model writing a
 * name or a role it was never given (ADR-0006, ADR-0007).
 */
export type DraftBlockReason =
  "truncated" | "refusal" | "request-failed" | "defect" | "output-blocked";

/**
 * What a draft is (session 12, ADR-0011). A `follow-up` is the model's draft after an
 * event; a `pre-event` email is composed from records before it, with no model. Both
 * are drafts: the gate exists for what leaves the device, not for what the model did.
 */
export type DraftKind = "follow-up" | "pre-event";

export interface DraftRecord extends BaseRecord {
  eventId: Id;
  attendeeId: Id | null;
  kind: DraftKind;
  /** The text the representative edits and exports. Empty when blocked. */
  body: string;
  /**
   * The text as generated, rehydrated and guarded, written once at creation and never
   * updated. Edit distance at export is computed against this; the audit record holds a
   * hash, not content, so the pre-image has to survive here.
   */
  generatedBody: string;
  state: DraftState;
  /** Non-null exactly when `state` is `blocked`. */
  blocked: DraftBlockReason | null;
  /**
   * Rule ids that fired on this draft. Duplicated from the audit record on purpose: the
   * review surface must be able to say why a sentence was replaced without reading the
   * audit trail, because a UI that depends on the audit log inverts the relationship.
   */
  flagsFired: string[];
  /** Null for a pre-event email: no prompt ran (ADR-0011). Mirrors the audit record. */
  promptTemplateVersion: string | null;
  guardrailRulesetVersion: string;
}

export const DRAFT_POLICIES: FieldPolicies<DraftRecord> = {
  ...BASE_POLICY,
  eventId: { encryption: "clear", why: "Foreign key; must be indexable." },
  attendeeId: { encryption: "clear", why: "Opaque foreign key; must be indexable." },
  kind: {
    encryption: "clear",
    why: "Enum; what the draft is. The review surface labels it.",
  },
  body: {
    encryption: "eligible",
    why: "Correspondence addressed to an identified person, post-rehydration.",
  },
  generatedBody: {
    encryption: "eligible",
    why: "The same correspondence before editing; identical sensitivity to body.",
  },
  state: {
    encryption: "clear",
    why: "Enum; the review gate queries on it, so it must be readable without a key.",
  },
  blocked: {
    encryption: "clear",
    why: "Enum reason; carries no content and no identity.",
  },
  flagsFired: {
    encryption: "clear",
    why: "Guardrail rule ids; no identity. Not a string, so could not be eligible.",
  },
  promptTemplateVersion: {
    encryption: "clear",
    why: "Version string; no identity. Null when no prompt ran (ADR-0011).",
  },
  guardrailRulesetVersion: { encryption: "clear", why: "Version string; no identity." },
};

// --- AuditRecord -----------------------------------------------------------

/**
 * Per plan §4.4 an audit record holds hashes, never content. Nothing here is
 * encryption-eligible, and that is the design rather than an oversight: an audit log an
 * auditor cannot read without the data-owner's passphrase is a worse audit log.
 *
 * Immutable in this sense: written once with its draft, in the same transaction; never
 * deleted, not even when the event is (ADR-0008); and touched exactly twice afterwards,
 * by the two review-gate transitions, each of which fills fields that are null until
 * then and refuses to fill them again. The generation facts never change.
 *
 * Every field an auditor needs is on the record itself, because after the event is
 * deleted the record is all that remains (ADR-0008).
 */
export interface AuditRecordRecord extends BaseRecord {
  draftId: Id;
  eventId: Id;
  /** Null when the draft was composed with no model (a pre-event email, ADR-0011). */
  model: string | null;
  /** Null when no prompt ran, which is the same case. */
  promptTemplateVersion: string | null;
  guardrailRulesetVersion: string;
  /**
   * SHA-256, hex, of the request body exactly as it crossed the boundary — pseudonymized
   * notes, recipient token, prior openings, event name — so the hash reconstructs
   * against material that names nobody. Null when nothing crossed (`defect`).
   */
  inputHash: string | null;
  /**
   * SHA-256, hex, of the model's text after the guardrails and before rehydration: what
   * the ruleset let through, still name-free. Null when the model produced no text.
   */
  outputHash: string | null;
  flagsFired: string[];
  /** Non-null exactly when the draft was withheld; the draft's own reason, copied. */
  blocked: DraftBlockReason | null;
  /** When a human opened the draft. Null until then. */
  reviewedAt: number | null;
  /** When a human exported the draft. Null until then. */
  exportedAt: number | null;
  /** Null until export; then whether the exported text differs from the generated. */
  humanEdited: boolean | null;
  /** Null until export; then the character edit distance, generated to exported. */
  editDistance: number | null;
  /**
   * The approved-content passages the draft carried, by id, in the order they appear
   * (session 9, v5). Plan §4.2: claim-bearing text is selected from the library, never
   * authored, and this is the record of what was selected. A passage removed from the
   * library later stays referenced here; the record survives (ADR-0008).
   */
  passagesUsed: Id[];
  /**
   * SHA-256, hex, over the library's normalised passage bodies at generation time, so
   * the record says which library the draft selected from. Null when the library was
   * empty and nothing could have been selected.
   */
  libraryVersion: string | null;
}

export const AUDIT_POLICIES: FieldPolicies<AuditRecordRecord> = {
  ...BASE_POLICY,
  draftId: { encryption: "clear", why: "Foreign key; must be indexable." },
  eventId: {
    encryption: "clear",
    why: "Foreign key; must be indexable. May point at a deleted event (ADR-0008).",
  },
  model: {
    encryption: "clear",
    why: "Model identifier; no identity. Null means composed with no model (ADR-0011): a pre-event email is a draft under the gate, and the record says honestly that nothing generated it.",
  },
  promptTemplateVersion: {
    encryption: "clear",
    why: "Version string; no identity. Null when no prompt ran, the same case as a null model.",
  },
  guardrailRulesetVersion: { encryption: "clear", why: "Version string; no identity." },
  inputHash: { encryption: "clear", why: "Hash, not content. That is the point of it." },
  outputHash: { encryption: "clear", why: "Hash, not content." },
  flagsFired: { encryption: "clear", why: "Guardrail rule ids; no identity." },
  blocked: { encryption: "clear", why: "Enum reason; no content." },
  reviewedAt: { encryption: "clear", why: "Timestamp; the review-gate signal." },
  exportedAt: { encryption: "clear", why: "Timestamp; the review-gate signal." },
  humanEdited: { encryption: "clear", why: "Boolean; the review-gate signal." },
  editDistance: {
    encryption: "clear",
    why: "Integer distance, not content. Plan §4.4 surfaces it as a dashboard metric.",
  },
  passagesUsed: { encryption: "clear", why: "Opaque ids of approved copy; no identity." },
  libraryVersion: { encryption: "clear", why: "Hash, not content." },
};

// --- VoiceProfile ----------------------------------------------------------

export interface VoiceProfileRecord extends BaseRecord {
  label: string;
  guidance: string;
  sampleText: string;
}

export const VOICE_PROFILE_POLICIES: FieldPolicies<VoiceProfileRecord> = {
  ...BASE_POLICY,
  label: { encryption: "clear", why: "User-chosen label for the profile; no identity." },
  guidance: {
    encryption: "eligible",
    why: "Judgement call: style guidance is not identity, but is drawn from real correspondence and may quote it.",
  },
  sampleText: {
    encryption: "eligible",
    why: "Real prior correspondence; may name people even after review.",
  },
};

// --- ApprovedContent -------------------------------------------------------

export interface ApprovedContentRecord extends BaseRecord {
  label: string;
  body: string;
  sourceRef: string;
}

/**
 * One approved passage (session 9). `body` is matched whole and exactly, after
 * normalisation, against the model's text; `sourceRef` holds the approving document's
 * code and version, per passage, so a draft's audit record can say which approved copy
 * it carried. The public build ships with this table empty; the private fork loads the
 * real passages there.
 */
export const APPROVED_CONTENT_POLICIES: FieldPolicies<ApprovedContentRecord> = {
  ...BASE_POLICY,
  label: { encryption: "clear", why: "Library label; no identity." },
  body: {
    encryption: "clear",
    why: "Approved promotional copy. Already cleared for external use by definition, so it holds no personal data; keeping it clear lets the claim matcher (session 9) read it without a key.",
  },
  sourceRef: { encryption: "clear", why: "Reference to the approving document." },
};

// --- Settings --------------------------------------------------------------

/**
 * The debounce written into a new settings row, and the hook's default.
 *
 * Lives here rather than in `useDebouncedAutosave` because this is the field that
 * persists it. Two constants with the same value in two files is the magic-number problem
 * wearing a name.
 */
export const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 300;

export interface SettingsRecord extends BaseRecord {
  activeEventId: Id | null;
  autosaveDebounceMs: number;
}

export const SETTINGS_POLICIES: FieldPolicies<SettingsRecord> = {
  ...BASE_POLICY,
  activeEventId: { encryption: "clear", why: "Opaque foreign key." },
  autosaveDebounceMs: { encryption: "clear", why: "Configuration integer." },
};

// --- SessionMarker (infrastructure, not a domain entity) -------------------

/**
 * Crash-recovery bookkeeping. Not part of plan §5's data model — it holds no user data
 * and exists only so an unclean shutdown is detectable on next load.
 *
 * A session with no `endedAt` is one that never shut down cleanly. `lastSeenAt` is
 * refreshed by a heartbeat while the tab is alive, so a recovered session can report
 * how much was in flight rather than merely that something was.
 */
export interface SessionMarkerRecord extends BaseRecord {
  startedAt: number;
  lastSeenAt: number;
  endedAt: number | null;
  /** Ids of notes written during this session, so recovery can report what is affected. */
  touchedNoteIds: Id[];
}

export const SESSION_MARKER_POLICIES: FieldPolicies<SessionMarkerRecord> = {
  ...BASE_POLICY,
  startedAt: { encryption: "clear", why: "Timestamp." },
  lastSeenAt: { encryption: "clear", why: "Timestamp; heartbeat." },
  endedAt: {
    encryption: "clear",
    why: "Timestamp or null. Recovery must read this before any key exists.",
  },
  touchedNoteIds: { encryption: "clear", why: "Opaque foreign keys." },
};

// --- Registry --------------------------------------------------------------

export const TABLES = {
  events: "events",
  attendees: "attendees",
  notes: "notes",
  drafts: "drafts",
  auditRecords: "auditRecords",
  voiceProfiles: "voiceProfiles",
  approvedContent: "approvedContent",
  settings: "settings",
  sessionMarkers: "sessionMarkers",
  images: "images",
  contacts: "contacts",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

/**
 * Single lookup from table name to its field policies. The cipher walks this, so a
 * table missing an entry cannot be written through the data-access layer.
 *
 * `FieldPolicies<never>` would not accept the concrete entity policies, and a union of
 * every entity type collapses to their common keys — so this is typed loosely on
 * purpose and guarded by `POLICY_TABLE_COVERAGE` below plus the schema unit test.
 */
export const POLICIES_BY_TABLE: Record<TableName, Record<string, FieldPolicy>> = {
  [TABLES.events]: EVENT_POLICIES,
  [TABLES.attendees]: ATTENDEE_POLICIES,
  [TABLES.notes]: NOTE_POLICIES,
  [TABLES.drafts]: DRAFT_POLICIES,
  [TABLES.auditRecords]: AUDIT_POLICIES,
  [TABLES.voiceProfiles]: VOICE_PROFILE_POLICIES,
  [TABLES.approvedContent]: APPROVED_CONTENT_POLICIES,
  [TABLES.settings]: SETTINGS_POLICIES,
  [TABLES.sessionMarkers]: SESSION_MARKER_POLICIES,
  [TABLES.images]: IMAGE_POLICIES,
  [TABLES.contacts]: CONTACT_POLICIES,
};

/** Field names that are encryption-eligible for a given table. */
export function eligibleFields(table: TableName): string[] {
  return Object.entries(POLICIES_BY_TABLE[table])
    .filter(([, policy]) => policy.encryption === "eligible")
    .map(([field]) => field);
}
