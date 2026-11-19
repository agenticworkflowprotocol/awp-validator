// Output of `awp validate` in the formats of the AWP CLI output formats, sections 1, 3 and 4
// (docs/cli.md in the specification repository).
import { API_VERSION, summarize } from './validator.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One diagnostic as a text line: `<file>:<line>:<column>: <severity> <code> <path>: <message>`. */
export function formatDiagnostic(d) {
  const src = d.source ?? {};
  const where = src.file ? `${src.file}${src.line ? `:${src.line}:${src.column}` : ''}: ` : '';
  const hint = d.hint ? `\n  hint: ${d.hint}` : '';
  return `${where}${d.severity} ${d.code}${d.path ? ` ${d.path}` : ''}: ${d.message}${hint}`;
}

function summaryLine(file, doc) {
  const label = doc.kind && doc.name ? ` (${[doc.kind, doc.name, doc.version].filter(Boolean).join(' ')})` : '';
  const errors = doc.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = doc.diagnostics.filter((d) => d.severity === 'warning').length;
  if (doc.valid) return `${file}${label}: valid${warnings ? `, ${plural(warnings, 'warning')}` : ''}`;
  return `${file}${label}: invalid, ${plural(errors, 'error')}${warnings ? `, ${plural(warnings, 'warning')}` : ''}`;
}

/**
 * Text output: all diagnostics, a blank line, then one summary line per document.
 * @param {{ file: string, documents: object[] }[]} files
 * @param {{ quiet?: boolean }} [options] quiet: only diagnostics of severity `error`
 */
export function formatText(files, { quiet = false } = {}) {
  const lines = [];
  for (const f of files) {
    for (const doc of f.documents) {
      for (const d of doc.diagnostics) if (!quiet || d.severity === 'error') lines.push(formatDiagnostic(d));
    }
  }
  if (quiet) return lines.join('\n');
  const summaries = files.flatMap((f) => f.documents.map((doc) => summaryLine(f.file, doc)));
  return [...lines, ...(lines.length ? [''] : []), ...summaries].join('\n');
}

/** Whether the command succeeded (exit code 0). */
export function isOk(files, { strict = false } = {}) {
  const s = summarize(files);
  return s.invalid === 0 && !(strict && s.warnings > 0);
}

/** JSON envelope `{ awp, command, ok, result }` of `awp validate --output json`. */
export function formatJson(files, { profiles, strict = false } = {}) {
  return {
    awp: API_VERSION,
    command: 'validate',
    ok: isOk(files, { strict }),
    result: { profiles, files, summary: summarize(files) },
  };
}
