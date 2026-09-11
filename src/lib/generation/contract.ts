/**
 * The shape of what crosses between the browser and the route, in both directions.
 *
 * One module, imported by both sides, so the route validates exactly what the client
 * sends and the client parses exactly what the route returns. The request carries
 * pseudonymized text only: the route never sees a name, a role, or the roster, because
 * the roster never leaves the device. That is why the route's own guard can only run the
 * structural half of `assertPseudonymized` — it is defence in depth behind the client's
 * full check, not a replacement for it.
 *
 * No zod here, on purpose. The route validates the request with zod (`route.ts`), but
 * this module is in the client bundle too, and zod's browser build probes for `Function`
 * at load — a CSP `script-src` violation under the policy in `src/proxy.ts` — and carries
 * every locale, which put four hundred kilobytes into the offline precache. The response
 * check the client needs is four fields, written out below.
 */

export type TokenKindName = "HCP" | "STAFF" | "PERSON" | "ROLE";

export interface GenerateRequest {
  /** Pseudonymized note bodies for one recipient, oldest first. */
  notes: string[];
  recipientToken: string;
  recipientKind: TokenKindName;
  /** First lines of drafts already produced in this batch, pseudonymized. */
  priorOpenings: string[];
  eventName: string;
}

/**
 * Why a response carries no usable draft. `truncated` and `refusal` are the model's
 * stop reasons, handled per the session 5 prompt: both block the draft.
 */
export type BlockReason = "truncated" | "refusal";

export interface GenerateResponse {
  /** Pseudonymized draft text. Empty when `blocked` is set. */
  text: string;
  blocked: BlockReason | null;
  /** The model that answered, as reported by the API. */
  model: string;
  promptTemplateVersion: string;
  /** Rules the route applied to the text before returning it: the private-term rule. */
  flagsFired: string[];
}

/** Whether a parsed JSON body is a `GenerateResponse`. */
export function isGenerateResponse(value: unknown): value is GenerateResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.text === "string" &&
    (candidate.blocked === null ||
      candidate.blocked === "truncated" ||
      candidate.blocked === "refusal") &&
    typeof candidate.model === "string" &&
    typeof candidate.promptTemplateVersion === "string" &&
    Array.isArray(candidate.flagsFired) &&
    candidate.flagsFired.every((flag) => typeof flag === "string")
  );
}

/**
 * The id of the route's own rule — the private-term rule in `private-terms.ts` — as it
 * appears in `flagsFired`. Defined here rather than beside the rule because the rule
 * reads a file with `node:fs` and cannot be imported by the client, while the review
 * surface has to be able to explain the flag when it sees it.
 */
export const PRIVATE_TERM_RULE_ID = "private-term";

/** The route. The single network destination in `src/`; see `tests/unit/single-egress.test.ts`. */
export const GENERATE_ROUTE = "/api/generate";
