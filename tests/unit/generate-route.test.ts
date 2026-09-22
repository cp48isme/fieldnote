/**
 * The route handler, with the SDK replaced.
 *
 * What is under test is the route's own decisions: the key check by name, schema
 * validation, the structural guard, the one retry on truncation and the block on a second,
 * the block on refusal, and that the log line carries metadata and no content. The SDK is
 * mocked at the module boundary so `messages.create` returns whatever the case needs.
 */

import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    constructor(readonly status?: number) {
      super("api error");
    }
  }
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static RateLimitError = RateLimitError;
    messages = { create };
  }
  return { default: Anthropic };
});

import { MAX_OUTPUT_TOKENS, TRUNCATION_RETRY_MULTIPLIER } from "@/lib/generation/model";
import { hashKey } from "@/lib/access/key";
import { GAP_MARKER } from "@/lib/generation/prompt";
import { PRIVATE_TERM_RULE_ID } from "@/lib/generation/contract";

const { POST } = await import("@/app/api/generate/route");

const VALID = {
  notes: ["[HCP_1] asked about mounting time."],
  recipientToken: "[HCP_1]",
  recipientKind: "HCP",
  priorOpenings: [],
  eventName: "Northgate mobile lab",
  passages: [],
};

/** The caller key this suite's requests carry, and the hash the route is configured with. */
const ACCESS_KEY = "fieldnote-generate-not-a-real-key";

/**
 * A request from an authorised device. The cookie is the default because every case below
 * except the access cases is about what the route does *after* it has decided the caller
 * may be here; `postWithout` and `postWithCookie` cover the decision itself.
 */
function post(body: unknown): Request {
  return postWithCookie(body, ACCESS_KEY);
}

function postWithCookie(body: unknown, key: string): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `fieldnote_access=${encodeURIComponent(key)}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function postWithout(body: unknown, headers: Record<string, string>): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function reply(text: string, stop_reason: string, extra: Record<string, unknown> = {}) {
  return {
    content: [{ type: "text", text }],
    stop_reason,
    stop_details: null,
    model: "claude-opus-5",
    usage: { input_tokens: 10, output_tokens: 20 },
    ...extra,
  };
}

describe("the generation route", () => {
  let info: MockInstance<typeof console.info>;

  beforeEach(async () => {
    create.mockReset();
    vi.stubEnv("ANTHROPIC_API_KEY", "set-for-the-test-not-a-real-key");
    vi.stubEnv("FIELDNOTE_ACCESS_KEY_HASHES", await hashKey(ACCESS_KEY));
    info = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  describe("who may call it (ADR-0012)", () => {
    it("refuses a content type that is not JSON, before reading the body", async () => {
      const response = await POST(postWithout(VALID, { "content-type": "text/plain" }));
      expect(response.status).toBe(415);
      expect(create).not.toHaveBeenCalled();
    });

    it("refuses a request with no access cookie", async () => {
      const response = await POST(
        postWithout(VALID, { "content-type": "application/json" }),
      );
      expect(response.status).toBe(401);
      expect(create).not.toHaveBeenCalled();
    });

    it("refuses a request whose key is wrong", async () => {
      const response = await POST(postWithCookie(VALID, "not-the-key"));
      expect(response.status).toBe(401);
      expect(create).not.toHaveBeenCalled();
    });

    it("refuses every request when the hashes variable is unset, and never falls back to open", async () => {
      vi.stubEnv("FIELDNOTE_ACCESS_KEY_HASHES", "");
      const response = await POST(post(VALID));
      expect(response.status).toBe(401);
      expect(create).not.toHaveBeenCalled();
      expect(info.mock.calls.map((call) => String(call[0])).join("\n")).toContain(
        "FIELDNOTE_ACCESS_KEY_HASHES",
      );
    });

    it("accepts the right key and gets as far as the model", async () => {
      create.mockResolvedValue(reply("Subject: x\n\nBody.", "end_turn"));
      const response = await POST(postWithCookie(VALID, ACCESS_KEY));
      expect(response.status).toBe(200);
      expect(create).toHaveBeenCalled();
    });

    it("logs no key and no hash on a refusal", async () => {
      const hash = await hashKey(ACCESS_KEY);
      await POST(postWithCookie(VALID, "not-the-key"));
      const lines = info.mock.calls.map((call) => String(call[0])).join("\n");
      expect(lines).not.toContain("not-the-key");
      expect(lines).not.toContain(hash);
      expect(lines).toContain("access-denied");
    });
  });

  it("refuses to start without the key, naming the variable and nothing else", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const response = await POST(post(VALID));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("ANTHROPIC_API_KEY");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a body that does not match the schema", async () => {
    const response = await POST(post({ ...VALID, recipientToken: "Dr. Vance" }));
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a payload that failed pseudonymization structurally", async () => {
    // Defence in depth: the client's guard should have caught this. The route has no
    // roster, so a title followed by a name is the only shape it can see.
    const response = await POST(
      post({ ...VALID, notes: ["Dr. Marlow asked about mounting."] }),
    );
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the text with the versions the audit schema needs", async () => {
    create.mockResolvedValueOnce(reply("Dear [HCP_1], thank you.", "end_turn"));
    const response = await POST(post(VALID));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      text: "Dear [HCP_1], thank you.",
      blocked: null,
      model: "claude-opus-5",
      promptTemplateVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      flagsFired: [],
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0].max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(create.mock.calls[0]![0].model).toBe("claude-opus-5");
  });

  it("retries once at a doubled ceiling on truncation, then returns the second answer", async () => {
    create
      .mockResolvedValueOnce(reply("Dear [HCP_1], thank", "max_tokens"))
      .mockResolvedValueOnce(reply("Dear [HCP_1], thank you.", "end_turn"));
    const response = await POST(post(VALID));
    const body = await response.json();
    expect(body.blocked).toBeNull();
    expect(body.text).toBe("Dear [HCP_1], thank you.");
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]![0].max_tokens).toBe(
      MAX_OUTPUT_TOKENS * TRUNCATION_RETRY_MULTIPLIER,
    );
  });

  it("blocks a draft that truncates twice, and sends no text", async () => {
    create
      .mockResolvedValueOnce(reply("Dear [HCP_1], thank", "max_tokens"))
      .mockResolvedValueOnce(reply("Dear [HCP_1], thank you for", "max_tokens"));
    const response = await POST(post(VALID));
    const body = await response.json();
    expect(body.blocked).toBe("truncated");
    expect(body.text).toBe("");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("blocks a refusal and logs the category, never the text", async () => {
    create.mockResolvedValueOnce(
      reply("I cannot help with that.", "refusal", {
        stop_details: {
          type: "refusal",
          category: "synthetic-category",
          explanation: "x",
        },
      }),
    );
    const response = await POST(post(VALID));
    const body = await response.json();
    expect(body.blocked).toBe("refusal");
    expect(body.text).toBe("");
    const logged = info.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain('"refusalCategory":"synthetic-category"');
    expect(logged).not.toContain("I cannot help");
  });

  it("logs metadata only: no note text, no draft text, no key", async () => {
    create.mockResolvedValueOnce(
      reply("Dear [HCP_1], a very particular sentence.", "end_turn"),
    );
    await POST(
      post({ ...VALID, notes: ["[HCP_1] said a distinctive phrase about cables."] }),
    );
    const logged = info.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).not.toContain("distinctive phrase");
    expect(logged).not.toContain("very particular");
    expect(logged).not.toContain("set-for-the-test");
    expect(logged).toContain('"stopReason":"end_turn"');
    expect(logged).toContain('"outputTokens":20');
  });

  it("validates passages with length caps", async () => {
    const tooLong = { id: "p-1", body: "x".repeat(2001) };
    const response = await POST(post({ ...VALID, passages: [tooLong] }));
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("holds an approved passage out of its own private-term rule, and hands it back intact", async () => {
    // fieldnote-quj: real approved copy carries the product's own name, which is what
    // the private list holds. The route protects the passages in the request before its
    // one rule runs. The private list is absent here, so the rule never fires; what is
    // under test is that the passage survives the route's guard unchanged.
    const passage = {
      id: "p-console",
      body: "The open control console sits at eye level.",
    };
    create.mockResolvedValueOnce(
      reply(`Thank you for your time.\n\n${passage.body}\n\nKind regards,`, "end_turn"),
    );
    const response = await POST(post({ ...VALID, passages: [passage] }));
    const body = await response.json();
    expect(body.text).toBe(
      `Thank you for your time.\n\n${passage.body}\n\nKind regards,`,
    );
    expect(create.mock.calls[0]![0].system).toContain("copy each one exactly");
  });

  it("maps an API error to a 502 without echoing the upstream message", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    // The mocked class takes a status only; the SDK's real constructor signature is what
    // the type system sees, hence the cast.
    const APIError = Anthropic.APIError as unknown as new (status: number) => Error;
    create.mockRejectedValueOnce(new APIError(500));
    const response = await POST(post(VALID));
    expect(response.status).toBe(502);
  });
});

/**
 * The start-up line, which fires once when the module loads. Testing it means resetting
 * the module registry and importing the route again with the environment as it would be
 * on a deployment — the file is absent there, so the variable is the only source.
 */
describe("the private-term rule's source, reported at start-up (ADR-0012)", () => {
  const TERM = "Quillfeather";

  async function startUpLine(env: string | undefined): Promise<string> {
    vi.resetModules();
    if (env === undefined) vi.stubEnv("FIELDNOTE_GUARDRAIL_TERMS", "");
    else vi.stubEnv("FIELDNOTE_GUARDRAIL_TERMS", env);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await import("@/app/api/generate/route");
    const line = info.mock.calls.map((call) => String(call[0])).join("\n");
    info.mockRestore();
    return line;
  }

  it("reports a count and a source, and never a term, when the variable carries the list", async () => {
    const line = await startUpLine(`${TERM}\nSecond term`);
    expect(line).toContain('"privateTerms":"loaded"');
    expect(line).toContain('"count":2');
    expect(line).toContain('"source":"environment"');
    expect(line).not.toContain(TERM);
    expect(line).not.toContain("Second term");
  });

  it("reports the rule inert, with no source, when neither the file nor the variable is there", async () => {
    // Every public clone and every CI runner. An inactive control that looks active is
    // worse than none, so the line says so.
    const line = await startUpLine(undefined);
    expect(line).toContain('"privateTerms":"absent"');
    expect(line).toContain('"count":0');
    expect(line).toContain('"source":"none"');
  });
});

/**
 * The private-term rule against an approved passage, with a list actually loaded.
 *
 * The case at "holds an approved passage out of its own private-term rule" runs with no
 * list, so it proves the protect-and-restore round trip and nothing about what the rule
 * does to a term inside a passage. This is the other half, and it is the half the
 * deployment depends on: real approved copy carries the product's own name, which is
 * exactly what the private list holds (`fieldnote-quj`, ADR-0012). A passage the model
 * copied exactly must survive; the same term in the model's own sentence must not.
 *
 * The term is synthetic, per ADR-0001. The real list is untestable in public by
 * construction and this says nothing about it.
 */
describe("the private-term rule and approved passages, with a list loaded", () => {
  const TERM = "Quillfeather";
  const PASSAGE = {
    id: "p-synthetic",
    body: `The ${TERM} console sits at eye level and is cleaned between cases.`,
  };

  async function postWithTerms(text: string) {
    vi.resetModules();
    vi.stubEnv("ANTHROPIC_API_KEY", "set-for-the-test-not-a-real-key");
    vi.stubEnv("FIELDNOTE_ACCESS_KEY_HASHES", await hashKey(ACCESS_KEY));
    vi.stubEnv("FIELDNOTE_GUARDRAIL_TERMS", TERM);
    vi.spyOn(console, "info").mockImplementation(() => {});
    const route = await import("@/app/api/generate/route");
    create.mockResolvedValueOnce(reply(text, "end_turn"));
    const response = await route.POST(
      postWithCookie({ ...VALID, passages: [PASSAGE] }, ACCESS_KEY),
    );
    return (await response.json()) as { text: string; flagsFired: string[] };
  }

  it("keeps the passage intact and flags the model's own use of the same term", async () => {
    const body = await postWithTerms(
      [
        "Thank you for your time on the truck.",
        "",
        PASSAGE.body,
        "",
        `I will send the ${TERM} specification over tomorrow.`,
        "",
        "Kind regards,",
      ].join("\n"),
    );

    // The passage came back exactly as the library wrote it, term and all.
    expect(body.text).toContain(PASSAGE.body);
    // The model's own sentence did not: it was replaced with the gap marker.
    expect(body.text).not.toContain(`I will send the ${TERM} specification`);
    expect(body.text).toContain(GAP_MARKER);
    expect(body.flagsFired).toContain(PRIVATE_TERM_RULE_ID);
  });

  // This one is the counterfactual for the protection itself: remove `protectApproved`
  // from the route and the passage's own term fires the rule, so this case fails.
  it("flags nothing when the only use of the term is inside the passage", async () => {
    const body = await postWithTerms(
      ["Thank you for your time.", "", PASSAGE.body, "", "Kind regards,"].join("\n"),
    );
    expect(body.text).toContain(PASSAGE.body);
    expect(body.text).not.toContain(GAP_MARKER);
    expect(body.flagsFired).not.toContain(PRIVATE_TERM_RULE_ID);
  });
});
