// Runs the vendored AWP conformance suites against a validator implementation, with the same
// pass criteria as the reference checker of the specification repository: v1alpha1 keeps its suite
// at the top of conformance/, later versions live in conformance/<version>/.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { API_VERSIONS } from '../src/versions.js';

const vendor = fileURLToPath(new URL('../vendor/awp/', import.meta.url));
const suiteDir = (version) => `${vendor}conformance/${version === API_VERSIONS[0] ? '' : `${version}/`}`;
const prefixOf = (version) => (version === API_VERSIONS[0] ? '' : `${version}/`);

/** The index of every suite, by API version. */
export const indexes = Object.fromEntries(API_VERSIONS.map((v) => [v, JSON.parse(readFileSync(`${suiteDir(v)}index.json`, 'utf8'))]));
/** All test cases of all suites, with the directory of their suite. */
export const cases = API_VERSIONS.flatMap((v) => indexes[v].tests.map((t) => ({ ...t, id: prefixOf(v) + t.id, path: t.path, dir: suiteDir(v) })));

const errorsOf = (fileResult) => fileResult.documents.flatMap((d) => d.diagnostics).filter((d) => d.severity === 'error');

function runCase(validateText, t) {
  const text = readFileSync(`${t.dir}${t.file}`, 'utf8');
  const errs = errorsOf(validateText(text, { file: t.file, profiles: t.profiles, verifyDigest: t.verifyDigest }));
  if (t.expect === 'valid') return { id: t.id, ok: errs.length === 0, detail: errs.map((e) => `${e.code} ${e.path}`).join('; ') };
  const hit = errs.filter((e) => e.code === t.code && (t.path === undefined || e.path === t.path || e.path.startsWith(`${t.path}/`)));
  const stray = errs.filter((e) => e.code.split('.')[0] !== t.code.split('.')[0]);
  return { id: t.id, ok: hit.length > 0 && stray.length === 0, detail: `expected ${t.code} at ${t.path ?? '*'}, got: ${errs.map((e) => `${e.code} ${e.path}`).join('; ') || 'accepted'}` };
}

/** @returns {{ id: string, ok: boolean, detail: string }[]} */
export function runSuite(validateText) {
  const results = cases.map((t) => runCase(validateText, t));
  for (const version of API_VERSIONS) {
    const examples = `${vendor}spec/${version}/examples/`;
    const skip = new Set(indexes[version].nonManifestExamples ?? []);
    for (const f of readdirSync(examples).sort()) {
      if (!/\.(ya?ml|json)$/.test(f) || skip.has(f)) continue;
      const errs = errorsOf(validateText(readFileSync(examples + f, 'utf8'), { file: f }));
      results.push({ id: `example:${version}/${f}`, ok: errs.length === 0, detail: errs.map((e) => `${e.code} ${e.path}`).join('; ') });
    }
  }
  return results;
}

/** Every file of valid/ and invalid/ of a suite that its index.json does not list. */
export function unindexedFiles() {
  return API_VERSIONS.flatMap((v) => {
    const listed = new Set(indexes[v].tests.map((t) => t.file));
    return ['valid', 'invalid'].flatMap((d) => readdirSync(`${suiteDir(v)}${d}`).map((f) => `${d}/${f}`)).filter((f) => !listed.has(f)).map((f) => prefixOf(v) + f);
  });
}
