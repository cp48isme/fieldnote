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
export const CURRENT_SCHEMA_VERSION = 1;

export type EncryptionClass =
  /** Encrypted at rest once session 19 replaces the identity cipher. */
  | "eligible"
  /** Stored in the clear. Required for indexing, or carries no identity. */
  | "clear";

export interface FieldPolicy {
  encryption: EncryptionClass;
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
};

// --- Attendee --------------------------------------------------------------

export interface AttendeeRecord extends BaseRecord {
  eventId: Id;
  displayName: string;
  role: string;
  specialty: string;
  institution: string;
}

export const ATTENDEE_POLICIES: FieldPolicies<AttendeeRecord> = {
  ...BASE_POLICY,
  eventId: { encryption: "clear", why: "Foreign key; must be indexable." },
  displayName: { encryption: "eligible", why: "Directly identifying." },
  role: {
    encryption: "eligible",
    why: "Judgement call: a role is not identifying alone, but is identifying alongside institution in a small department.",
  },
  specialty: {
    encryption: "eligible",
    why: "Same reasoning as role; a specialty plus an institution narrows sharply.",
  },
  institution: { encryption: "eligible", why: "Directly identifying in combination." },
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

/** Per plan §4.3 and CLAUDE.md, export is gated on a human opening the draft. */
export type DraftState = "generated" | "reviewed" | "exported";

export interface DraftRecord extends BaseRecord {
  eventId: Id;
  attendeeId: Id | null;
  body: string;
  state: DraftState;
  promptTemplateVersion: string;
  guardrailRulesetVersion: string;
}

export const DRAFT_POLICIES: FieldPolicies<DraftRecord> = {
  ...BASE_POLICY,
  eventId: { encryption: "clear", why: "Foreign key; must be indexable." },
  attendeeId: { encryption: "clear", why: "Opaque foreign key; must be indexable." },
  body: {
    encryption: "eligible",
    why: "Correspondence addressed to an identified person, post-rehydration.",
  },
  state: {
    encryption: "clear",
    why: "Enum; the review gate queries on it, so it must be readable without a key.",
  },
  promptTemplateVersion: { encryption: "clear", why: "Version string; no identity." },
  guardrailRulesetVersion: { encryption: "clear", why: "Version string; no identity." },
};

// --- AuditRecord -----------------------------------------------------------

/**
 * Per plan §4.4 an audit record holds hashes, never content. Nothing here is
 * encryption-eligible, and that is the design rather than an oversight: an audit log an
 * auditor cannot read without the data-owner's passphrase is a worse audit log.
 */
export interface AuditRecordRecord extends BaseRecord {
  draftId: Id;
  eventId: Id;
  model: string;
  promptTemplateVersion: string;
  guardrailRulesetVersion: string;
  inputHash: string;
  outputHash: string;
  flagsFired: string[];
  humanEdited: boolean;
  editDistance: number | null;
}

export const AUDIT_POLICIES: FieldPolicies<AuditRecordRecord> = {
  ...BASE_POLICY,
  draftId: { encryption: "clear", why: "Foreign key; must be indexable." },
  eventId: { encryption: "clear", why: "Foreign key; must be indexable." },
  model: { encryption: "clear", why: "Model identifier; no identity." },
  promptTemplateVersion: { encryption: "clear", why: "Version string; no identity." },
  guardrailRulesetVersion: { encryption: "clear", why: "Version string; no identity." },
  inputHash: { encryption: "clear", why: "Hash, not content. That is the point of it." },
  outputHash: { encryption: "clear", why: "Hash, not content." },
  flagsFired: { encryption: "clear", why: "Guardrail rule ids; no identity." },
  humanEdited: { encryption: "clear", why: "Boolean; the review-gate signal." },
  editDistance: {
    encryption: "clear",
    why: "Integer distance, not content. Plan §4.4 surfaces it as a dashboard metric.",
  },
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
};

/** Field names that are encryption-eligible for a given table. */
export function eligibleFields(table: TableName): string[] {
  return Object.entries(POLICIES_BY_TABLE[table])
    .filter(([, policy]) => policy.encryption === "eligible")
    .map(([field]) => field);
}
