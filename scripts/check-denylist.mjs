#!/usr/bin/env node
//
// Denylist pre-commit check
// =========================
//
// Blocks identifying information from entering the repository. Enforces the ADR-0001
// constraint ("no real personal data, anywhere, ever") as code rather than as a habit.
//
// DESIGN DECISION: the term list is not committed.
//
// A file enumerating the real names this repo exists to protect would publish exactly
// what the check prevents. Hashing them is not a fix: proper nouns are short, drawn
// from a small distribution, and fall to a dictionary attack in seconds. Committing
// hashed names and calling them protected would be a false assurance in a repository
// whose subject is governance, which is worse than shipping no check at all.
//
// So the check is split in two:
//
//   - Structural patterns (emails, US phone numbers) are defined here and committed.
//     They describe a SHAPE, not a person, and are safe to publish.
//   - Literal terms are loaded from `.denylist.local`, which is gitignored. Each
//     developer maintains their own from `.denylist.local.example`.
//
// HONEST LIMITATION — read before relying on this:
//
//   CI cannot see `.denylist.local`. It is gitignored by design, so it is not present
//   in a fresh clone or on a build runner. The term check is therefore LOCAL ONLY.
//   The CI gate covers structural patterns and nothing more.
//
//   This means CI cannot catch a real name committed from a machine with no local
//   term list, or one whose list is stale. That gap is accepted deliberately — the
//   alternative is publishing the names — but it is a gap, not a guarantee, and it
//   should not be described as one in the README or the compliance map. The control
//   this check provides is "defense in depth against accidental paste", not
//   "identifying information cannot enter this repository".
//
//   The durable mitigation is human review of every diff touching prose, which no
//   pattern can replace.
//
// SECOND HONEST LIMITATION — terms match literal spellings only:
//
//   Each entry in `.denylist.local` becomes a case-insensitive regex with a word
//   boundary at each end. That catches the term as written and nothing else. A name
//   split across words, missing a letter, or carrying a trailing plural does not match:
//   with `Quillfeather` listed, `quill feather`, `Quilfeather`, and `Quillfeathers` all
//   pass clean. Verified, not assumed.
//
//   This matters most where it is least obvious. Device dictation mangles surnames by
//   design — phoneticised, split, or heard as a common noun (ADR-0005) — so text derived
//   from the dictated notes in `private/` is exactly the text this check cannot see. The
//   eval corpus and the tokenizer fixtures from session 4 onward are made of it.
//
//   Do not read a green hook as evidence that no real name is in the diff. It is
//   evidence that no *listed spelling* is, which is a much smaller claim. For any diff
//   carrying text derived from the dictated notes, human review is the control and this
//   check is a backstop — not the other way round. Listing known mangled variants
//   alongside each real name narrows the gap and does not close it; the space of
//   mishearings is open, and a matcher loose enough to cover it would fire on ordinary
//   prose and be bypassed, for the same reason the phone pattern below is conservative.
//
//   Recorded as `fieldnote-ech`, and owed a first-class entry in session 15's threat
//   model: an untrusted input channel defeating a control is the same class of finding
//   as prompt injection via dictated input, which that session already treats as such.
//
// A second deliberate tradeoff: the phone pattern requires separator punctuation and
// does not match ten bare consecutive digits. Bare-digit matching fires on timestamps,
// content hashes, and build IDs, and a check that cries wolf gets bypassed with
// `--no-verify` within a week. False negatives were preferred over false positives
// that would erode the hook's credibility.
//
// Failure output prints the file, the line number, and the pattern NAME only — never
// the matched text. Hook output lands in terminal scrollback, CI logs, and editor
// panes; echoing the term back would leak it into exactly the places this check exists
// to keep it out of.
//
// Usage:
//   node scripts/check-denylist.mjs          scan staged content (pre-commit)
//   node scripts/check-denylist.mjs --all    scan all tracked files (CI)

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const TERMS_FILE = ".denylist.local";
const scanAll = process.argv.includes("--all");

// Patterns describing a shape, never a person. Safe to commit.
const STRUCTURAL = [
  {
    name: "email-address",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    name: "us-phone-number",
    // Requires punctuation. Formats, written with N standing in for a digit so this
    // comment does not trip the pattern it documents:
    //   (NNN) NNN-NNNN | NNN-NNN-NNNN | NNN.NNN.NNNN | +1 NNN NNN NNNN
    re: /(?:\+1[-.\s])?(?:\(\d{3}\)\s?|\b\d{3}[-.])\d{3}[-.\s]\d{4}\b/g,
  },
];

// Paths never scanned. The denylist files are excluded because one holds the terms
// themselves and the other holds deliberately synthetic placeholders. The rest are
// dependency trees, lockfiles, and build output — machine-written, and none of it a
// place a person types a name.
//
// `public/` was on this list and was removed. It is not build output: the app icons are
// hand-written SVG with comments in them, and anything else added there is committed
// source too. Excluding it meant a real name in an icon comment or a manifest string
// reached a public commit with no gate in front of it, which was verified by staging one
// and watching the check pass. Whatever the entry was originally for — most likely
// binary assets — is already handled by the NUL-byte test below, which skips binaries by
// content rather than by path. The two generated files that do live there, `sw.js` and
// `precache.json`, are gitignored and so are never staged for this check to see.
const SKIP = [
  /^node_modules\//,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)\.denylist\.local(\.example)?$/,
  /(^|\/)\.git\//,
  /^\.next\//,
];

function git(args) {
  const r = spawnSync("git", args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return null;
  return r.stdout;
}

function loadTerms() {
  if (!existsSync(TERMS_FILE)) return null;
  return readFileSync(TERMS_FILE, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function termPatterns(terms) {
  return terms.map((term, i) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Word boundaries only when the term starts/ends with a word character, so
    // multi-word and punctuated entries still match.
    const lead = /^\w/.test(term) ? "\\b" : "";
    const tail = /\w$/.test(term) ? "\\b" : "";
    return {
      name: `denylist-term#${i + 1}`,
      re: new RegExp(lead + escaped + tail, "gi"),
    };
  });
}

function filesToScan() {
  // --all covers tracked AND untracked-but-not-ignored files, so it is meaningful
  // before the first commit exists. --exclude-standard keeps gitignored paths out,
  // which is correct for a commit gate: .denylist.local is never a candidate.
  const out = scanAll
    ? git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    : git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACM"]);
  if (!out) return [];
  return out
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((f) => !SKIP.some((re) => re.test(f)));
}

function contentOf(file) {
  // Read staged content from the index, not the working tree: the index is what the
  // commit will actually contain.
  if (scanAll) {
    try {
      return readFileSync(file);
    } catch {
      return null;
    }
  }
  const buf = git(["show", `:${file}`]);
  if (buf !== null) return buf;
  try {
    return readFileSync(file);
  } catch {
    return null;
  }
}

const terms = loadTerms();
const patterns = [...STRUCTURAL, ...(terms ? termPatterns(terms) : [])];
const findings = [];

for (const file of filesToScan()) {
  const buf = contentOf(file);
  if (!buf) continue;
  if (buf.includes(0)) continue; // binary
  const lines = buf.toString("utf8").split("\n");
  lines.forEach((line, i) => {
    for (const p of patterns) {
      p.re.lastIndex = 0;
      if (p.re.test(line)) findings.push({ file, line: i + 1, pattern: p.name });
    }
  });
}

const scope = scanAll ? "all tracked files" : "staged changes";

if (terms === null) {
  console.warn(
    `\x1b[33mwarning\x1b[0m  ${TERMS_FILE} not found — term check INACTIVE, structural patterns only.\n` +
      `         Copy .denylist.local.example to ${TERMS_FILE} and add your terms.\n` +
      `         This is expected in CI and on a fresh clone; see the header of this script.`,
  );
}

if (findings.length === 0) {
  const active = terms
    ? `${patterns.length} patterns`
    : `${patterns.length} structural patterns`;
  console.log(`denylist: clean (${scope}, ${active})`);
  process.exit(0);
}

// Location and pattern name only. Never the matched text.
console.error(
  `\n\x1b[31mdenylist check failed\x1b[0m — ${findings.length} match(es) in ${scope}:\n`,
);
for (const f of findings) console.error(`  ${f.file}:${f.line}  [${f.pattern}]`);
console.error(
  `\nThe matched text is withheld deliberately; open the file at the line above.\n` +
    `If this is a false positive, adjust the pattern rather than bypassing the hook.\n`,
);
process.exit(1);
