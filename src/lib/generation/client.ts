/**
 * The API client: the one place in the browser that talks to the network.
 *
 * Plan §4.1 and ADR-0005: the model API route is the only egress from this system. This
 * file is the allowed destination in `tests/unit/single-egress.test.ts`, and the
 * `connect-src 'self'` directive in the security headers is the browser-enforced version
 * of the same claim. Everything sent through here has been through `createPseudonymizer`
 * and `assertPseudonymized` in `pipeline.ts`; this module does not check that itself,
 * because a check here would be a second copy of the one that matters.
 */

import {
  GENERATE_ROUTE,
  isGenerateResponse,
  type GenerateRequest,
  type GenerateResponse,
} from "./contract";

export class GenerationRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "GenerationRequestError";
  }
}

export type RequestDraft = (request: GenerateRequest) => Promise<GenerateResponse>;

export const requestDraft: RequestDraft = async (request) => {
  let response: Response;
  try {
    response = await fetch(GENERATE_ROUTE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    // Offline, most likely. The message names the situation, never the payload.
    throw new GenerationRequestError("The generation route could not be reached.", null);
  }

  if (!response.ok) {
    throw new GenerationRequestError(
      `The generation route answered ${response.status}.`,
      response.status,
    );
  }

  const body: unknown = await response.json();
  if (!isGenerateResponse(body)) {
    throw new GenerationRequestError(
      "The generation route answered in a shape this client does not understand.",
      response.status,
    );
  }
  return body;
};
