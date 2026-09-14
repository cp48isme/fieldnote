/**
 * Approved copy in the draft: found, held out of the rules, and put back. Plan §4.2.
 *
 * THE MATCH IS EXACT, WHOLE PASSAGE, AFTER NORMALISATION. Whitespace collapsed, Unicode
 * quotes and dashes folded to ASCII, case preserved. Nothing looser: a passage the model
 * reworded by one word is not approved copy, and it is blocked as claim-bearing with the
 * gap marker — which is §4.2 working, not a failure. Anything looser would be a second
 * heuristic with a threshold nobody can defend, and a paraphrase that scored high would
 * be exactly what §4.2 says to block. A passage's sentence quoted alone does not match:
 * approved copy is approved as a whole.
 *
 * WHAT NORMALISATION DELIBERATELY DOES NOT MATCH. Case: "the open control panel" is not
 * "The open control panel", because a passage that begins a sentence and one that does
 * not are different approved strings, and the library's body is the one that was
 * approved. Punctuation beyond quotes and dashes: a dropped full stop is a change.
 *
 * MECHANISM. Before the sentence rules run, every span of the model's text that equals
 * a library passage is replaced by a placeholder; the rules run; the placeholders are
 * replaced by the library's own body — the canonical, approved string — not the model's
 * spelling of it. The rest of the text, its line breaks included, is left exactly as the
 * model wrote it: the match is whitespace-tolerant, the text is not rewritten. The placeholder is U+0001-delimited, distinct from the pseudonymizer's
 * U+0000 ones, which never survive past `pseudonymize()` in any case, and
 * `applyGuardrails` passes a placeholder segment through unjudged (ruleset 1.3.0).
 *
 * THE EXEMPTION IS HONEST BECAUSE LOADING IS STRICT. An approved span passes every rule,
 * the regulatory passage's indication language included, so `refusalFor` is applied when
 * a passage is loaded: the pricing, hospitality, patient, and invented-name rules, and
 * the pseudonymizer's structural guard. Approved copy that mentions a meal is not
 * approved copy for a follow-up.
 */

import { assertPseudonymized, PseudonymizationError } from "@/lib/privacy/pseudonymize";

import { applyGuardrails, RULESET } from "./guardrails";
import { sha256Hex } from "./hash";

export interface ApprovedPassage {
  id: string;
  body: string;
}

/** Whitespace to single spaces, quotes and dashes to ASCII, trimmed. Case kept. */
export function normaliseText(text: string): string {
  return foldPunctuation(text).replace(/\s+/g, " ").trim();
}

/**
 * Curly quotes and the dash family to ASCII, one character for one, so that an index
 * into the folded text is an index into the original. Whitespace is not touched here:
 * that is what keeps the draft's line breaks where the model put them.
 */
function foldPunctuation(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-");
}

const placeholder = (index: number) => `\u0001${index}\u0001`;
const PLACEHOLDER = /\u0001(\d+)\u0001/g;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A passage as a pattern over the folded text: its normalised words in order, any
 * whitespace between them, at word boundaries. Whole passage or nothing.
 */
function patternFor(body: string): RegExp | null {
  const words = normaliseText(body)
    .split(" ")
    .filter((w) => w.length > 0);
  if (words.length === 0) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${words.map(escapeRegExp).join("\\s+")}(?![\\p{L}\\p{N}])`,
    "gu",
  );
}

export interface ProtectedText {
  /** The text with each approved span replaced by a placeholder; everything else as it was. */
  text: string;
  /** Placeholder index to passage. */
  table: ApprovedPassage[];
  /** Ids of the passages found, in order of first appearance, each once. */
  used: string[];
}

/**
 * Finds every whole passage in `text` and replaces it with a placeholder, leaving the
 * rest of the text — its line breaks included — exactly as it was. Longest passages
 * first, so a passage that contains another is matched as itself.
 */
export function protectApproved(
  text: string,
  library: readonly ApprovedPassage[],
): ProtectedText {
  let working = text;
  const table: ApprovedPassage[] = [];
  const candidates = library
    .map((passage) => ({ passage, pattern: patternFor(passage.body) }))
    .filter((c): c is { passage: ApprovedPassage; pattern: RegExp } => c.pattern !== null)
    .sort(
      (a, b) =>
        normaliseText(b.passage.body).length - normaliseText(a.passage.body).length,
    );

  for (const { passage, pattern } of candidates) {
    // Search the folded text, splice the original: the fold is length-preserving.
    const folded = foldPunctuation(working);
    const spans: Array<[number, number]> = [];
    for (const match of folded.matchAll(pattern)) {
      spans.push([match.index, match.index + match[0].length]);
    }
    for (const [from, to] of spans.reverse()) {
      const index = table.push(passage) - 1;
      working = working.slice(0, from) + placeholder(index) + working.slice(to);
    }
  }

  // Ids in the order the passages appear in the text, each once.
  const used: string[] = [];
  for (const [, index] of working.matchAll(PLACEHOLDER)) {
    const id = table[Number(index)]!.id;
    if (!used.includes(id)) used.push(id);
  }
  return { text: working, table, used };
}

/** Puts the library's own body back where each placeholder stands. */
export function restoreApproved(text: string, table: readonly ApprovedPassage[]): string {
  return text.replace(
    PLACEHOLDER,
    (mark, index: string) => table[Number(index)]?.body ?? mark,
  );
}

/** A hash over the library's normalised bodies, order-independent; null when empty. */
export async function libraryVersionOf(
  library: readonly ApprovedPassage[],
): Promise<string | null> {
  const bodies = library.map((p) => normaliseText(p.body)).filter((b) => b.length > 0);
  if (bodies.length === 0) return null;
  return sha256Hex(bodies.sort().join("\n"));
}

/** The rules a passage must not trip to be loaded. Claim-bearing and indication are its nature. */
const LOAD_RULES = new Set(["pricing", "hospitality", "patient", "invented-name"]);

/**
 * Why a passage may not be loaded, or null. The rule id that fired, or
 * `pseudonymization` when the structural guard would refuse the body — a passage that
 * names a person after a title would cross the boundary as a name.
 */
export function refusalFor(body: string): string | null {
  const ruleset = RULESET.filter((rule) => LOAD_RULES.has(rule.id));
  const { flagsFired } = applyGuardrails(body, ruleset);
  if (flagsFired.length > 0) return flagsFired[0]!;
  try {
    assertPseudonymized(body, []);
  } catch (cause) {
    if (cause instanceof PseudonymizationError) return "pseudonymization";
    throw cause;
  }
  return null;
}
