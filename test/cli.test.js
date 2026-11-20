import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { main } from '../src/cli.js';

const VALID = readFileSync(new URL('../vendor/awp/spec/v1alpha1/examples/vulnerability-fixer.workflow.yaml', import.meta.url), 'utf8');
const INVALID = VALID.replace(/dependsOn: \[fix\]|dependsOn:\n(\s+)- fix/, (m) => m.replace('fix', 'ghost'));
const files = { 'ok.yaml': VALID, 'bad.yaml': INVALID };

function run(args, input = files) {
  let out = '';
  let err = '';
  const code = main(args, {
    stdout: (s) => { out += s; },
    stderr: (s) => { err += s; },
    readFile: (f) => {
      if (!(f in input)) throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      return input[f];
    },
  });
  return { code, out, err };
}

test('valid file: summary line and exit code 0', () => {
  const r = run(['validate', 'ok.yaml']);
  assert.equal(r.code, 0);
  assert.equal(r.out, 'ok.yaml (Workflow vulnerability-fixer 0.1.0): valid\n');
});

test('invalid file: diagnostics, blank line, summary, exit code 1', () => {
  assert.notEqual(INVALID, VALID, 'fixture must differ');
  const r = run(['validate', 'bad.yaml']);
  assert.equal(r.code, 1);
  const lines = r.out.trimEnd().split('\n');
  assert.match(lines[0], /^bad\.yaml:\d+:\d+: error dependsOn\.unknown-step \/spec\/workflow\/\d+\/dependsOn\/\d+: /);
  assert.equal(lines.at(-2), '');
  assert.match(lines.at(-1), /^bad\.yaml \(Workflow vulnerability-fixer 0\.1\.0\): invalid, 1 error$/);
});

test('JSON envelope follows the CLI output format', () => {
  const r = run(['validate', '--output', 'json', '--profiles', 'core,governance,mcp,audit,security,a2a', 'ok.yaml', 'bad.yaml']);
  assert.equal(r.code, 1);
  const json = JSON.parse(r.out);
  assert.equal(json.awp, 'v1alpha1');
  assert.equal(json.command, 'validate');
  assert.equal(json.ok, false);
  assert.deepEqual(json.result.summary, { documents: 2, valid: 1, invalid: 1, errors: 1, warnings: 0 });
  assert.deepEqual(json.result.files.map((f) => f.file), ['ok.yaml', 'bad.yaml']);
  assert.equal(json.result.files[1].documents[0].diagnostics[0].code, 'dependsOn.unknown-step');
});

test('usage errors exit with 2, unreadable files with 3', () => {
  assert.equal(run(['validate']).code, 2);
  assert.equal(run(['validate', '--profiles', 'core,nope', 'ok.yaml']).code, 2);
  assert.equal(run(['validate', '--output', 'xml', 'ok.yaml']).code, 2);
  assert.equal(run(['validate', '--bogus', 'ok.yaml']).code, 2);
  assert.equal(run(['lint', 'ok.yaml']).code, 2);
  const missing = run(['validate', 'missing.yaml']);
  assert.equal(missing.code, 3);
  assert.match(missing.err, /cannot read missing\.yaml: ENOENT/);
});

// A tool source on an undeclared MCP server is valid with the warning mcp.server-unresolved (spec 5.5.1).
const WARNING = `apiVersion: awp.agenticworkflowprotocol.org/v1alpha1
kind: Workflow
metadata:
  name: warn
  version: 0.1.0
  owner:
    team: example-team
  classification: internal
spec:
  agents:
    - id: helper
      model:
        provider: example-provider
        name: example-model
      tools:
        - type: mcp
          server: tickets
          tools: [get_ticket]
  workflow:
    - id: run
      agent: helper
`;

test('--strict fails on warnings, --quiet prints only errors', () => {
  const r = run(['validate', 'w.yaml'], { 'w.yaml': WARNING });
  assert.equal(r.code, 0);
  assert.match(r.out, /warning mcp\.server-unresolved /);
  assert.match(r.out, /w\.yaml \(Workflow warn 0\.1\.0\): valid, 2 warnings\n$/);
  assert.equal(run(['validate', '--strict', 'w.yaml'], { 'w.yaml': WARNING }).code, 1);
  assert.equal(run(['validate', '--quiet', 'w.yaml'], { 'w.yaml': WARNING }).out, '');
  const quiet = run(['validate', '--quiet', 'bad.yaml']);
  assert.match(quiet.out, /^bad\.yaml:\d+:\d+: error dependsOn\.unknown-step [^\n]+\n$/);
});

test('--version and --help', () => {
  assert.match(run(['--version']).out, /^awp-validator \d+\.\d+\.\d+ \(AWP v1alpha1, v1alpha2, v1alpha3, specification [0-9a-f]{7}\)\n$/);
  assert.match(run(['--help']).out, /Usage: awp validate/);
});

test('the bin script reads standard input', () => {
  const bin = fileURLToPath(new URL('../bin/awp.js', import.meta.url));
  const r = spawnSync(process.execPath, [bin, 'validate', '-'], { input: VALID, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '<stdin> (Workflow vulnerability-fixer 0.1.0): valid\n');
});
