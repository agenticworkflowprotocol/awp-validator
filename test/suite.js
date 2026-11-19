// Runs the vendored AWP conformance suite against a validator implementation, with the same
// pass criteria as the reference checker of the specification repository.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { API_VERSIONS } from '../src/versions.js';

const vendor = fileURLToPath(new URL('../vendor/awp/', import.meta.url));
export const index = JSON.parse(readFileSync(`${vendor}conformance/index.json`, 'utf8'));

const errorsOf = (fileResult) => fileResult.documents.flatMap((d) => d.diagnostics).filter((d) => d.severity === 'error');

/** @returns {{ id: string, ok: boolean, detail: string }[]} */
export function runSuite(validateText) {
  const results = [];
  for (const t of index.tests) {
    const text = readFileSync(`${vendor}conformance/${t.file}`, 'utf8');
    const errs = errorsOf(validateText(text, { file: t.file, profiles: t.profiles, verifyDigest: t.verifyDigest }));
    if (t.expect === 'valid') {
      results.push({ id: t.id, ok: errs.length === 0, detail: errs.map((e) => `${e.code} ${e.path}`).join('; ') });
      continue;
    }
    const hit = errs.filter((e) => e.code === t.code && (t.path === undefined || e.path === t.path || e.path.startsWith(`${t.path}/`)));
    const stray = errs.filter((e) => e.code.split('.')[0] !== t.code.split('.')[0]);
    results.push({ id: t.id, ok: hit.length > 0 && stray.length === 0, detail: `expected ${t.code} at ${t.path ?? '*'}, got: ${errs.map((e) => `${e.code} ${e.path}`).join('; ') || 'accepted'}` });
  }
  for (const version of API_VERSIONS) {
    const examples = `${vendor}spec/${version}/examples/`;
    for (const f of readdirSync(examples).sort()) {
      if (!/\.(ya?ml|json)$/.test(f) || index.nonManifestExamples.includes(f)) continue;
      const errs = errorsOf(validateText(readFileSync(examples + f, 'utf8'), { file: f }));
      results.push({ id: `example:${version}/${f}`, ok: errs.length === 0, detail: errs.map((e) => `${e.code} ${e.path}`).join('; ') });
    }
  }
  return results;
}

/** Every file of valid/ and invalid/ that index.json does not list. */
export function unindexedFiles() {
  const listed = new Set(index.tests.map((t) => t.file));
  return ['valid', 'invalid'].flatMap((dir) => readdirSync(`${vendor}conformance/${dir}`).map((f) => `${dir}/${f}`)).filter((f) => !listed.has(f));
}
