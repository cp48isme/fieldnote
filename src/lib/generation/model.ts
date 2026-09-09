/**
 * The model call's fixed parameters, in one place.
 *
 * Everything the audit schema's `model` field and session 6's audit record will need to
 * cite lives here, so changing any of it is a one-line diff in a file a reviewer knows to
 * look at. Nothing in this file is read from the client bundle: `route.ts` is the only
 * importer of the values that matter, and the id is exported so the client can record
 * which model it asked for.
 */

/**
 * The model identifier, exactly as the API accepts it. No date suffix — the API rejects
 * ids assembled from memory, and the instruction for this project is to stop and ask
 * rather than try another.
 */
export const MODEL_ID = "claude-opus-5";

/**
 * How many times the SDK retries a request before giving up. The SDK retries 408, 409,
 * 429, 5xx (which includes 529 overloaded) and connection errors, with backoff. This is
 * the count; the policy is the SDK's.
 */
export const MAX_RETRIES = 3;

/**
 * The output ceiling for one follow-up email, in tokens, and the reasoning.
 *
 * The longest of the eight writing samples is about 220 words, roughly 300 tokens. The
 * model thinks before it writes, and thinking tokens count against this ceiling, so the
 * ceiling has to hold a draft and the reasoning behind it. 4096 is about ten times the
 * longest sample plus room to think at low effort, chosen so that reaching it signals a
 * runaway rather than a long email. The prototype's drafts came back cut off because this
 * number was set artificially low for a test; that was a configuration correction, not
 * logic, and the guide's session 5 entry says so.
 */
export const MAX_OUTPUT_TOKENS = 4096;

/**
 * On `stop_reason: "max_tokens"` the route retries once at this multiple of the ceiling.
 * If the second attempt truncates too, the draft is marked truncated and blocked: a
 * cut-off email reads as finished until the reader reaches the end, and it is being
 * copied into a mail client.
 */
export const TRUNCATION_RETRY_MULTIPLIER = 2;

/**
 * Reasoning effort. A follow-up email is not a hard problem, and lower effort means less
 * thinking inside the output ceiling. Thinking is left on rather than disabled, because
 * disabling it on this model family can leak reasoning tags into the visible text.
 */
export const EFFORT = "low" as const;
