/**
 * The rendered display name of every job in a workflow file, which is the string GitHub
 * reports as a status check and the string branch protection matches against.
 *
 * Why a parser here and not a dependency: the repository has no YAML library, and one
 * would be a dependency bought to read three files whose shape this repository controls.
 * This reads the subset those files use — block mappings, block and flow sequences,
 * scalars, and folded or literal block scalars — and nothing more. A construct outside
 * that subset (an anchor, a multi-document file, a flow mapping) is not silently
 * misread: the parser throws, and the test that calls it fails, which is the correct
 * direction for a tripwire.
 *
 * Why a template is resolved rather than compared literally: GitHub's own generated
 * CodeQL workflow names its job `Analyze (${{ matrix.language }})`, and the check it
 * reports is the rendered form, `Analyze (javascript-typescript)`. A literal comparison
 * would fail on a correct workflow written that way, or — if the expected string were
 * changed to match the template — pass while the rendered check changed. So a
 * `${{ matrix.<key> }}` in a name is expanded against the job's `strategy.matrix`, one
 * rendered name per combination. A matrix using `include` or `exclude`, or a template
 * that is not a matrix reference, throws rather than guessing: extend this file when
 * one appears.
 *
 * A job with no `name` renders as its id, which is what GitHub does.
 */

export type YamlValue = string | YamlValue[] | YamlMapping;
export interface YamlMapping {
  [key: string]: YamlValue;
}

interface Line {
  indent: number;
  text: string;
  number: number;
}

/** Non-blank, non-comment lines with a trailing ` # comment` removed outside quotes. */
function significantLines(source: string): Line[] {
  const out: Line[] = [];
  source.split(/\r?\n/).forEach((raw, index) => {
    const withoutComment = stripComment(raw);
    if (withoutComment.trim() === "") return;
    const indent = withoutComment.length - withoutComment.trimStart().length;
    out.push({ indent, text: withoutComment.trim(), number: index + 1 });
  });
  return out;
}

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]!))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(scalar: string): string {
  const trimmed = scalar.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

const KEY = /^([A-Za-z_][\w.-]*|"[^"]*"|'[^']*'):(?:\s+(.*))?$/;

class Parser {
  private index = 0;

  constructor(private readonly lines: Line[]) {}

  parse(): YamlValue {
    if (this.lines.length === 0) return {};
    const value = this.block(this.lines[0]!.indent);
    if (this.index < this.lines.length) this.fail("unparsed content");
    return value;
  }

  private fail(reason: string): never {
    const line = this.lines[this.index];
    const where = line ? `line ${line.number}` : "end of file";
    throw new Error(`workflow yaml: ${reason} at ${where}`);
  }

  private block(indent: number): YamlValue {
    const line = this.lines[this.index];
    if (!line) this.fail("expected a block");
    if (line.indent !== indent) this.fail("unexpected indentation");
    if (line.text.startsWith("- ") || line.text === "-") return this.sequence(indent);
    if (KEY.test(line.text)) return this.mapping(indent);
    return this.fail("expected a mapping or a sequence");
  }

  private sequence(indent: number): YamlValue[] {
    const items: YamlValue[] = [];
    while (this.index < this.lines.length) {
      const line = this.lines[this.index]!;
      if (line.indent !== indent || !(line.text.startsWith("- ") || line.text === "-"))
        break;
      const rest = line.text === "-" ? "" : line.text.slice(2).trim();
      if (rest === "") {
        this.index += 1;
        items.push(this.block(this.nextIndentDeeperThan(indent)));
      } else if (KEY.test(rest)) {
        // `- key: value` — a mapping whose first pair shares the dash's line. The pair is
        // re-read as if it sat at the mapping's own indent, which is indent + 2.
        this.lines[this.index] = { ...line, indent: indent + 2, text: rest };
        items.push(this.mapping(indent + 2));
      } else {
        this.index += 1;
        items.push(this.scalar(rest, indent));
      }
    }
    return items;
  }

  private mapping(indent: number): YamlMapping {
    const out: YamlMapping = {};
    while (this.index < this.lines.length) {
      const line = this.lines[this.index]!;
      if (line.indent < indent) break;
      if (line.indent > indent) this.fail("unexpected indentation");
      const match = KEY.exec(line.text);
      if (!match) break;
      const key = unquote(match[1]!);
      const rest = match[2]?.trim() ?? "";
      this.index += 1;
      if (rest === "") {
        const next = this.lines[this.index];
        out[key] = next && next.indent > indent ? this.block(next.indent) : "";
      } else {
        out[key] = this.scalar(rest, indent);
      }
    }
    return out;
  }

  private nextIndentDeeperThan(indent: number): number {
    const next = this.lines[this.index];
    if (!next || next.indent <= indent) this.fail("expected a nested block");
    return next.indent;
  }

  /** A scalar on one line: quoted, flow sequence, block scalar, or bare. */
  private scalar(text: string, indent: number): YamlValue {
    if (text.startsWith("[")) {
      if (!text.endsWith("]")) this.fail("a flow sequence must close on its line");
      const inner = text.slice(1, -1).trim();
      return inner === "" ? [] : inner.split(",").map(unquote);
    }
    if (text.startsWith("{")) this.fail("flow mappings are outside the subset");
    if (text.startsWith("&") || text.startsWith("*"))
      this.fail("anchors are outside the subset");
    if (/^[>|]/.test(text)) {
      const folded = text.startsWith(">");
      const parts: string[] = [];
      while (this.index < this.lines.length && this.lines[this.index]!.indent > indent) {
        parts.push(this.lines[this.index]!.text);
        this.index += 1;
      }
      return parts.join(folded ? " " : "\n");
    }
    return unquote(text);
  }
}

export function parseWorkflowYaml(source: string): YamlValue {
  return new Parser(significantLines(source)).parse();
}

function isMapping(value: YamlValue | undefined): value is YamlMapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TEMPLATE = /\$\{\{\s*([^}]*?)\s*\}\}/g;
const MATRIX_REFERENCE = /^matrix\.([\w-]+)$/;

/** Every combination of a job's matrix, as one mapping per combination. */
function matrixCombinations(jobId: string, matrix: YamlValue | undefined): YamlMapping[] {
  if (matrix === undefined) return [];
  if (!isMapping(matrix)) throw new Error(`${jobId}: strategy.matrix is not a mapping`);
  for (const reserved of ["include", "exclude"]) {
    if (reserved in matrix) {
      throw new Error(
        `${jobId}: strategy.matrix uses \`${reserved}\`, which this resolver does not expand — extend tests/unit/support/workflow-jobs.ts`,
      );
    }
  }
  let combinations: YamlMapping[] = [{}];
  for (const [key, values] of Object.entries(matrix)) {
    if (!Array.isArray(values))
      throw new Error(`${jobId}: matrix.${key} is not a sequence`);
    combinations = combinations.flatMap((combination) =>
      values.map((value) => {
        if (typeof value !== "string") {
          throw new Error(`${jobId}: matrix.${key} holds a non-scalar value`);
        }
        return { ...combination, [key]: value };
      }),
    );
  }
  return combinations;
}

function render(
  jobId: string,
  template: string,
  combination: YamlMapping | null,
): string {
  return template.replace(TEMPLATE, (_, expression: string) => {
    const reference = MATRIX_REFERENCE.exec(expression);
    if (!reference) {
      throw new Error(
        `${jobId}: name carries \`${expression}\`, which is not a matrix reference`,
      );
    }
    const value = combination?.[reference[1]!];
    if (typeof value !== "string") {
      throw new Error(
        `${jobId}: name refers to matrix.${reference[1]} but the job's matrix has no such key`,
      );
    }
    return value;
  });
}

/** Rendered display names, keyed by job id. A job with a matrix renders one per combination. */
export function renderedJobNames(source: string): Map<string, string[]> {
  const document = parseWorkflowYaml(source);
  if (!isMapping(document) || !isMapping(document.jobs)) {
    throw new Error("workflow yaml: no `jobs` mapping");
  }
  const out = new Map<string, string[]>();
  for (const [jobId, job] of Object.entries(document.jobs)) {
    if (!isMapping(job)) throw new Error(`${jobId}: job is not a mapping`);
    const template = typeof job.name === "string" && job.name !== "" ? job.name : jobId;
    const strategy = isMapping(job.strategy) ? job.strategy : undefined;
    const combinations = matrixCombinations(jobId, strategy?.matrix);
    const names =
      combinations.length === 0
        ? [render(jobId, template, null)]
        : combinations.map((combination) => render(jobId, template, combination));
    out.set(jobId, names);
  }
  return out;
}
