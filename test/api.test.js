import assert from 'node:assert/strict';
import { test } from 'node:test';
import { API_VERSION, API_VERSIONS, KNOWN_PROFILES, UsageError, migrateToV1alpha3, provenance, schema, schemas, validateManifest, validateText } from '../src/index.js';
import { parse as parseFirst, stringify } from 'yaml';

const VALID = `apiVersion: awp.agenticworkflowprotocol.org/v1alpha1
kind: Workflow
metadata:
  name: hello
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
  workflow:
    - id: greet
      agent: helper
`;

test('a valid manifest has no errors and carries kind, name and version', () => {
  const { file, documents } = validateText(VALID, { file: 'hello.yaml' });
  assert.equal(file, 'hello.yaml');
  assert.equal(documents.length, 1);
  assert.deepEqual({ ...documents[0], diagnostics: undefined }, { document: 0, kind: 'Workflow', name: 'hello', version: '0.1.0', awp: 'v1alpha1', valid: true, diagnostics: undefined });
});

const V2 = VALID.replace('awp.agenticworkflowprotocol.org/v1alpha1', 'awp.agenticworkflowprotocol.org/v1alpha2');
const ITERATING = `${V2.trimEnd()}
      dependsOn: []
      forEach:
        items: "\${{ inputs.files }}"
        maxItems: 10
`;

test('each document is validated against the schema of its own apiVersion', () => {
  assert.deepEqual(API_VERSIONS, ['v1alpha1', 'v1alpha2', 'v1alpha3']);
  assert.equal(validateText(V2).documents[0].awp, 'v1alpha2');
  assert.equal(validateText(V2).documents[0].valid, true);
  // A document in the layout of the current draft with an unsupported apiVersion: only the version is wrong.
  const current = stringify(migrateToV1alpha3(parseFirst(VALID)).document);
  const unknown = validateText(current.replace('/v1alpha3', '/v1alpha99')).documents[0];
  assert.equal(unknown.awp, 'v1alpha3', 'an unsupported version is checked against the current draft');
  assert.deepEqual(unknown.diagnostics.map((d) => [d.code, d.path]), [['schema.const', '/apiVersion']]);
});

test('forEach is a v1alpha2 field: accepted there, an unknown field in v1alpha1', () => {
  const withInput = ITERATING.replace('spec:\n', 'spec:\n  inputs:\n    - name: files\n      type: array\n      required: true\n');
  const v2 = validateText(withInput).documents[0];
  assert.deepEqual(v2.diagnostics.filter((d) => d.severity === 'error'), []);
  const v1 = validateText(withInput.replace('/v1alpha2', '/v1alpha1')).documents[0];
  assert.equal(v1.valid, false);
  assert.ok(v1.diagnostics.some((d) => d.code === 'schema.additionalProperties' && d.path.endsWith('/forEach')));
});

test('extension fields are accepted, unknown fields are rejected with position', () => {
  const ext = VALID.replace('      agent: helper\n', '      agent: helper\n      x-example-note: hi\n');
  assert.equal(validateText(ext).documents[0].valid, true);
  const unknown = VALID.replace('      agent: helper\n', '      agent: helper\n      note: hi\n');
  const [doc] = validateText(unknown, { file: 'w.yaml' }).documents;
  assert.equal(doc.valid, false);
  assert.deepEqual(doc.diagnostics[0], {
    severity: 'error', code: 'schema.additionalProperties', message: 'must NOT have additional properties',
    path: '/spec/workflow/0/note', document: 0, source: { file: 'w.yaml', line: 18, column: 13 },
  });
});

test('semantic errors carry the specification section', () => {
  const broken = VALID.replace('      agent: helper\n', '      agent: helper\n      dependsOn: [ghost]\n');
  const d = validateText(broken).documents[0].diagnostics.find((x) => x.severity === 'error');
  assert.equal(d.code, 'dependsOn.unknown-step');
  assert.equal(d.section, '5.6.3');
  assert.equal(d.path, '/spec/workflow/0/dependsOn/0');
});

test('fields of unselected profiles are rejected', () => {
  const mcp = VALID.replace('spec:\n', 'spec:\n  mcpServers:\n    - name: git\n      transport: streamable-http\n      url: https://git.example.com/mcp\n');
  assert.equal(validateText(mcp, { profiles: ['core', 'mcp'] }).documents[0].valid, true);
  const codes = validateText(mcp, { profiles: 'core' }).documents[0].diagnostics.map((d) => d.code);
  assert.ok(codes.includes('profile.unsupported'));
});

test('multi-document files and YAML restrictions', () => {
  const two = `${VALID}---\n${VALID.replace('name: hello', 'name: second')}`;
  const { documents } = validateText(two);
  assert.deepEqual(documents.map((d) => [d.document, d.name, d.valid]), [[0, 'hello', true], [1, 'second', true]]);
  const tagged = validateText('a: !custom x\n').documents[0];
  assert.equal(tagged.diagnostics[0].code, 'yaml.custom-tag');
  assert.equal(validateText('').documents[0].diagnostics[0].code, 'yaml.empty');
  assert.equal(validateText('a: 1\na: 2\n').documents[0].diagnostics[0].code, 'yaml.parse-error');
});

test('validateManifest checks parsed values without positions', () => {
  const r = validateManifest({ apiVersion: 'awp.agenticworkflowprotocol.org/v1alpha1', kind: 'Workflow' });
  assert.equal(r.valid, false);
  assert.ok(r.diagnostics.every((d) => d.source === undefined && d.code.startsWith('schema.')));
});

test('unknown profiles are a usage error', () => {
  assert.throws(() => validateText(VALID, { profiles: ['core', 'nope'] }), UsageError);
  assert.throws(() => validateManifest({}, { profiles: [] }), UsageError);
});

test('schema, profiles and provenance are exported', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.deepEqual(KNOWN_PROFILES, ['core', 'governance', 'audit', 'security', 'mcp', 'a2a', 'interaction']);
  assert.equal(schema.$id, 'https://agenticworkflowprotocol.org/schema/awp.v1alpha3.json', 'the default schema is the current draft');
  assert.equal(API_VERSION, 'v1alpha3');
  assert.match(provenance.source.commit, /^[0-9a-f]{40}$/);
});

test('v1alpha3: governance fields in spec, forEach as in v1alpha2, migration from v1alpha2', () => {
  const withInput = ITERATING.replace('spec:\n', 'spec:\n  inputs:\n    - name: files\n      type: array\n      required: true\n');
  const { document, notes } = migrateToV1alpha3(parseFirst(withInput));
  assert.deepEqual(notes, []);
  assert.equal(document.apiVersion, 'awp.agenticworkflowprotocol.org/v1alpha3');
  assert.equal(document.spec.version, '0.1.0');
  assert.equal(document.metadata.version, undefined);
  const v3 = validateText(stringify(document)).documents[0];
  assert.equal(v3.awp, 'v1alpha3');
  assert.equal(v3.version, '0.1.0', 'the version comes from spec in v1alpha3');
  assert.deepEqual(v3.diagnostics.filter((d) => d.severity === 'error'), []);
  assert.ok(schemas.v1alpha3.$defs.ForEach, 'v1alpha3 has step iteration');
  // v1alpha1 layout is rejected in v1alpha3: version belongs to spec there.
  const oldLayout = validateText(withInput.replace('/v1alpha2', '/v1alpha3')).documents[0];
  assert.equal(oldLayout.valid, false);
});
