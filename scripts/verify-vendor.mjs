#!/usr/bin/env node
// Checks that vendor/awp-v1alpha1 is exactly what PROVENANCE.json records: every listed file exists
// with its SHA-256 hash, and no unlisted file was added. Run in CI so that a hand edit fails.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'awp-v1alpha1');
const provenance = JSON.parse(readFileSync(join(dir, 'PROVENANCE.json'), 'utf8'));

const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

export function verifyVendor() {
  const problems = [];
  const listed = new Set();
  for (const { path, sha256 } of provenance.files) {
    listed.add(path);
    let actual;
    try {
      actual = createHash('sha256').update(readFileSync(join(dir, path))).digest('hex');
    } catch {
      problems.push(`missing: ${path}`);
      continue;
    }
    if (actual !== sha256) problems.push(`changed: ${path}`);
  }
  for (const file of walk(dir)) {
    const rel = relative(dir, file).split('\\').join('/');
    if (rel !== 'PROVENANCE.json' && !listed.has(rel)) problems.push(`not in PROVENANCE.json: ${rel}`);
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = verifyVendor();
  for (const p of problems) console.error(p);
  console.log(problems.length ? `vendor check failed (${problems.length})` : `vendor ok: ${provenance.files.length} files from ${provenance.source.commit}`);
  process.exit(problems.length ? 1 : 0);
}
