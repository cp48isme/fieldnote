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

const { POST } = await import("@/app/api/generate/route");

const VALID = {
  notes: ["[HCP_1] asked about mounting time."],
  recipientToken: "[HCP_1]",
  recipientKind: "HCP",
  priorOpenings: [],
  eventName: "Northgate mobile lab",
};

function post(body: unknown): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
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

  beforeEach(() => {
    create.mockReset();
    vi.stubEnv("ANTHROPIC_API_KEY", "set-for-the-test-not-a-real-key");
    info = vi.spyOn(console, "info").mockImplementation(() => {});
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
