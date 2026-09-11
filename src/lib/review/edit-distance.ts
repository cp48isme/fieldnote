/**
 * Character-level Levenshtein distance between the text as generated and the text as
 * exported. Plan §4.4's quiet centrepiece, stored on the audit record at export.
 *
 * What the number means, and does not: it is how many single-character insertions,
 * deletions, or substitutions separate the two strings. Zero means the export was
 * verbatim. It does not measure diligence. A low distance may be a careful reviewer
 * agreeing with a good draft; a high one may be a reviewer rewriting a bad one, or
 * pasting in a signature. It is a signal to be read across many drafts, not a score for
 * one, and every surface that shows it says so.
 *
 * Characters rather than words or lines because the unit has to be one that cannot be
 * argued with — a "word" edit is a tokenisation choice, a character edit is not — and
 * because the gap marker the guardrails insert is what a reviewer most often replaces,
 * which a word measure would count as one edit whether they wrote a sentence or a
 * paragraph in its place.
 *
 * Two rows, not a matrix: a draft is a few thousand characters at most, and the full
 * table would be tens of megabytes for no gain.
 */

export function editDistance(from: string, to: string): number {
  if (from === to) return 0;
  if (from.length === 0) return [...to].length;
  if (to.length === 0) return [...from].length;

  // Code points, so that a character outside the basic plane counts once.
  const a = [...from];
  const b = [...to];

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      const insertion = current[j - 1]! + 1;
      const deletion = previous[j]! + 1;
      current[j] = Math.min(substitution, insertion, deletion);
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length]!;
}
