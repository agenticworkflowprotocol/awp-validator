import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as node from '../src/index.js';
import { verifyVendor } from '../scripts/verify-vendor.mjs';
import { cases, runSuite, unindexedFiles } from './suite.js';

const bundlePath = fileURLToPath(new URL('../dist/browser/awp-validator.mjs', import.meta.url));

test('vendored specification files match PROVENANCE.json', () => {
  assert.deepEqual(verifyVendor(), []);
});

test('every conformance case is indexed', () => {
  assert.deepEqual(unindexedFiles(), []);
});

test('Node.js validator passes the conformance suite and validates the spec examples', () => {
  const results = runSuite(node.validateText);
  const failed = results.filter((r) => !r.ok);
  assert.ok(results.length > cases.length, 'examples are included');
  assert.deepEqual(failed, []);
});

test('browser bundle passes the same suite with identical diagnostics', { skip: !existsSync(bundlePath) && 'run npm run build first' }, async () => {
  const browser = await import(bundlePath);
  assert.deepEqual(runSuite(browser.validateText).filter((r) => !r.ok), []);
  // Same codes, paths and positions as the Node.js build for every case.
  for (const t of cases) {
    const opts = { file: t.file, profiles: t.profiles, verifyDigest: t.verifyDigest };
    const text = (await import('node:fs')).readFileSync(`${t.dir}${t.file}`, 'utf8');
    assert.deepEqual(browser.validateText(text, opts), node.validateText(text, opts), t.id);
  }
});

test('browser digest shim computes the same manifest digest as node:crypto', { skip: !existsSync(bundlePath) && 'run npm run build first' }, async () => {
  const browser = await import(bundlePath);
  const manifest = { apiVersion: 'awp.agenticworkflowprotocol.org/v1alpha1', kind: 'Workflow', metadata: { name: 'ä-ü', version: '1.0.0' }, spec: { x: [1, 'zwölf'] } };
  for (const alg of ['sha256', 'sha384', 'sha512']) {
    assert.equal(browser.manifestDigest(manifest, alg), node.manifestDigest(manifest, alg), alg);
  }
});
