// Reads AWP manifests from text with the YAML restrictions of spec 3.1: YAML 1.2 core schema,
// no custom tags, string keys only, no duplicate keys. JSON is valid YAML 1.2 and goes the same way.
import { LineCounter, isCollection, isScalar, parseAllDocuments, visit } from 'yaml';

const firstLine = (message) => String(message).split('\n')[0];

function restrictionDiagnostics(doc) {
  const diagnostics = [];
  for (const e of doc.errors) {
    diagnostics.push({ severity: 'error', code: 'yaml.parse-error', message: firstLine(e.message), path: '', section: '3.1', pos: e.pos?.[0] });
  }
  for (const w of doc.warnings) {
    const code = /tag/i.test(w.message) ? 'yaml.custom-tag' : 'yaml.warning';
    diagnostics.push({ severity: 'error', code, message: firstLine(w.message), path: '', section: '3.1', pos: w.pos?.[0] });
  }
  visit(doc, {
    Pair(_, pair) {
      const key = pair.key;
      if (isCollection(key) || (isScalar(key) && typeof key.value !== 'string')) {
        diagnostics.push({ severity: 'error', code: 'yaml.non-string-key', message: 'mapping keys MUST be strings', path: '', section: '3.1', pos: key.range?.[0] });
      }
    },
  });
  return diagnostics;
}

/**
 * Parse every document of a text.
 * @param {string} text
 * @returns {{ doc: import('yaml').Document, value: unknown, diagnostics: object[], lineCounter: LineCounter }[]}
 */
export function loadDocuments(text) {
  const lineCounter = new LineCounter();
  const docs = parseAllDocuments(String(text), { version: '1.2', schema: 'core', lineCounter, uniqueKeys: true });
  // parseAllDocuments returns an EmptyStream (not an array) for input without documents.
  return Array.from(docs, (doc) => {
    const diagnostics = restrictionDiagnostics(doc);
    const value = diagnostics.length ? undefined : doc.toJS();
    return { doc, value, diagnostics, lineCounter };
  });
}

/** 1-based line and column of the node at a JSON Pointer, or of its closest existing parent. */
export function positionOf(doc, lineCounter, pointer) {
  const parts = pointer ? pointer.split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~')) : [];
  for (let n = parts.length; n >= 0; n--) {
    const keys = parts.slice(0, n).map((s) => (/^\d+$/.test(s) ? Number(s) : s));
    const node = n === 0 ? doc.contents : doc.getIn(keys, true);
    if (node?.range) {
      const { line, col } = lineCounter.linePos(node.range[0]);
      return { line, column: col };
    }
  }
  return undefined;
}

/** Position of a character offset. */
export function positionAt(lineCounter, offset) {
  const { line, col } = lineCounter.linePos(offset);
  return { line, column: col };
}
