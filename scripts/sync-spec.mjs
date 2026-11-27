#!/usr/bin/env node
// Copies the normative AWP artefacts this validator is built on from a checkout of the
// specification repository into vendor/awp/ and records commit and SHA-256 hashes in
// PROVENANCE.json. One commit of the specification provides every supported API version: one
// schema, one example directory and one conformance suite per version, and one set of semantic
// rules for all of them. The vendored files are never edited by hand: update them with this
// script and review the diff.
//
//   node scripts/sync-spec.mjs <path-to-agenticworkflowprotocol.org-checkout>
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_VERSIONS } from '../src/versions.js';

const SPEC_REPOSITORY = 'https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org';
/** Paths copied from the specification repository (files or directories). */
const SOURCES = [
  'LICENSE',
  'LICENSE-SPEC',
  ...API_VERSIONS.map((v) => `schema/awp.${v}.json`),
  'conformance/semantic.mjs',
  'conformance/human-input.mjs',
  'conformance/conditions.mjs',
  'conformance/migrate.mjs',
  'conformance/index.json',
  'conformance/valid',
  'conformance/invalid',
  ...API_VERSIONS.slice(1).map((v) => `conformance/${v}`),
  ...API_VERSIONS.map((v) => `spec/${v}/examples`),
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'vendor', 'awp');

function listFiles(dir) {
  return readdirSync(dir).sort().flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function main(specRoot) {
  if (!specRoot) {
    console.error('usage: node scripts/sync-spec.mjs <path-to-specification-checkout>');
    return 2;
  }
  const src = resolve(specRoot);
  if (git(src, 'status', '--porcelain')) {
    console.error(`${src} has uncommitted changes; sync only from a clean checkout`);
    return 1;
  }
  rmSync(target, { recursive: true, force: true });
  const files = [];
  for (const entry of SOURCES) {
    const from = join(src, entry);
    const sourceFiles = statSync(from).isDirectory() ? listFiles(from) : [from];
    for (const file of sourceFiles) {
      const rel = relative(src, file);
      const to = join(target, rel);
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(file, to);
      files.push({ path: rel, sha256: sha256(to) });
    }
  }
  const provenance = {
    schemaVersion: 1,
    description: 'Unchanged copy of the AWP schema, semantic rules, conformance suite and examples. Never edit by hand; run scripts/sync-spec.mjs and review the diff.',
    awpVersions: API_VERSIONS,
    source: {
      repository: SPEC_REPOSITORY,
      commit: git(src, 'rev-parse', 'HEAD'),
      commitDate: git(src, 'show', '-s', '--format=%cI', 'HEAD'),
    },
    licenses: {
      'Apache-2.0': 'code, JSON schema, conformance manifests and examples (LICENSE)',
      'CC-BY-4.0': 'Markdown prose (LICENSE-SPEC)',
    },
    files,
  };
  writeFileSync(join(target, 'PROVENANCE.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(`vendored ${files.length} files from ${provenance.source.commit}`);
  return 0;
}

process.exit(main(process.argv[2]));
