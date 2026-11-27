# AWP Validator

[![npm](https://img.shields.io/npm/v/@agenticworkflowprotocol/validator?label=npm)](https://www.npmjs.com/package/@agenticworkflowprotocol/validator) [![ci](https://github.com/agenticworkflowprotocol/awp-validator/actions/workflows/ci.yml/badge.svg)](https://github.com/agenticworkflowprotocol/awp-validator/actions/workflows/ci.yml) [![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

Reference validator for [Agentic Workflow Protocol (AWP)](https://agenticworkflowprotocol.org)
manifests: the YAML restrictions, the JSON Schema and the semantic rules of AWP `v1alpha3` (the
current draft), the next draft `v1alpha4` (step conditions `when` and workflow steps), `v1alpha2`
and `v1alpha1` (each document is checked against the schema of its own
`apiVersion`), per
conformance profile, with digest verification and machine-readable diagnostics.

- **Web:** [validator.agenticworkflowprotocol.org](https://validator.agenticworkflowprotocol.org) – runs
  in the browser, the manifest is not uploaded.
- **CLI:** `awp validate`, with the output formats and exit codes of the
  [AWP CLI output formats](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/docs/cli.md#4-awp-validate).
- **Editor and viewer:** [editor.agenticworkflowprotocol.org](https://editor.agenticworkflowprotocol.org)
  ([awp-editor](https://github.com/agenticworkflowprotocol/awp-editor)) is built on this validator.
- **Library:** for Node.js and for the browser (one ES module, no `eval`), to validate manifests
  inside your own runtime, editor or CI.

Status: alpha, like the specification. The validator passes the AWP conformance suite (validator
role, spec 11.1); it is not a runtime and says nothing about runtime conformance.

## Install

```sh
npm install --save-exact @agenticworkflowprotocol/validator
```

Every push to `main` with a new `version` in `package.json` is released automatically: tag, GitHub release and npm with provenance (`.github/workflows/publish.yml`). Without registry access, install the
tarball of a [GitHub release](https://github.com/agenticworkflowprotocol/awp-validator/releases):

```sh
npm install --save-exact \
  https://github.com/agenticworkflowprotocol/awp-validator/releases/download/v0.1.0/agenticworkflowprotocol-validator-0.1.0.tgz
```

Each release also contains the browser bundle `awp-validator.mjs`, the JSON Schema and
`SHA256SUMS`. Node.js 20 or newer. Runtime dependencies: `ajv` and `yaml` (pinned).

## Command line

```sh
npx awp validate workflow.yaml
npx awp validate --profiles core,mcp --verify-digest workflow.yaml other.yaml
cat workflow.yaml | npx awp validate --output json -
```

```text
workflow.yaml:31:11: error dependsOn.unknown-step /spec/workflow/1/dependsOn/0: dependsOn names non-existent step "ghost"

workflow.yaml (Workflow vulnerability-fixer 0.1.0): invalid, 1 error
```

| Option | Meaning |
| --- | --- |
| `--profiles <list>` | Supported profiles (`core`, `governance`, `audit`, `security`, `mcp`, `a2a`). Fields of other profiles are rejected (spec 3.3). Default: all. |
| `--verify-digest` | Verify `metadata.integrity.digest` (spec 9.1). |
| `--strict` | Warnings fail the command. |
| `--output text\|json` | `json` prints the envelope `{ awp, command, ok, result }`. |
| `--quiet` | Only diagnostics of severity `error`. |

Exit codes: `0` valid, `1` invalid, `2` usage error, `3` file could not be read.

## Library

```js
import { validateText, validateManifest } from '@agenticworkflowprotocol/validator';

// Text (YAML or JSON, several documents allowed), with line and column per diagnostic.
const { documents } = validateText(text, { file: 'workflow.yaml', profiles: ['core', 'mcp'] });
if (!documents.every((d) => d.valid)) {
  for (const d of documents.flatMap((doc) => doc.diagnostics)) {
    console.error(`${d.source.line}:${d.source.column} ${d.code} ${d.path}: ${d.message}`);
  }
}

// An already parsed value, for example a request body.
const result = validateManifest(manifest, { profiles: ['core', 'mcp'] });
```

Diagnostics follow [section 3 of the CLI output formats](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/docs/cli.md#3-diagnostics):
`severity`, `code` (stable), `message`, `path` (JSON Pointer), `section`, `document`, `source`.

Further exports: `formatText`, `formatJson` (the `awp validate` formats), `manifestDigest`, `jcs`,
`migrateToV1alpha3`, `migrateToV1alpha4` (from every older version), `schemas` (by API version), `schema` (current draft `v1alpha3`), `provenance`, `KNOWN_PROFILES`, `API_VERSIONS`. Each
document result carries `awp`, the API version it was validated as. Types are included
(`types/index.d.ts`). The schema files are also available as
`@agenticworkflowprotocol/validator/schema/v1alpha1.json`, `.../schema/v1alpha2.json`, `.../schema/v1alpha3.json`, `.../schema/v1alpha4.json` and
`.../schema.json` (current draft).

### Embedding in a runtime

A runtime that supports only some profiles passes exactly those, so that manifests with fields of
other profiles are rejected instead of being run without them:

```js
const { valid, diagnostics } = validateManifest(manifest, { profiles: ['core', 'mcp'] });
if (!valid) throw new ManifestRejected(diagnostics.filter((d) => d.severity === 'error'));
// Runtime-specific rules (deployment policy) come after this check and may only be stricter.
```

### Browser

```js
import { validateText } from '@agenticworkflowprotocol/validator/browser';
```

The browser entry is a single bundled ES module (`dist/browser/awp-validator.mjs`, also attached
to every release). The JSON Schema validator is precompiled, so it runs under a
Content-Security-Policy without `unsafe-eval`, and digests use a synchronous SHA-2 implementation.

## Specification pin

`vendor/awp/` is an unchanged copy of the schemas of every supported API version, the semantic
rules, the conformance suite and the examples of the specification repository at the commit recorded in
`PROVENANCE.json`, with a SHA-256 hash per file. `npm test` fails if a vendored file differs.

Update to a newer specification commit:

```sh
node scripts/sync-spec.mjs ../agenticworkflowprotocol.org   # clean checkout at the wanted commit
npm test
```

## Development

```sh
npm ci
npm test          # builds dist/, then runs the conformance suite (Node.js and browser bundle) and unit tests
npm run build     # dist/browser/ and dist/site/
```

The website in `site/` is built into `dist/site/` and deployed by the Cloudflare Pages project
`awp-validator` on every push to `main`. The output directory is set in `wrangler.toml`; the build
command `npm ci && npm run build` is set in the Pages dashboard. `site/_headers` sets a strict
Content-Security-Policy (no inline scripts, no external requests).

## Releasing

1. Set the new `version` in `package.json` (semantic versioning) and add a `## [x.y.z]` section to
   `CHANGELOG.md`.
2. Push to `main` (directly or by merging a pull request).

The `publish` workflow runs on every push to `main`. If the version is not on npm yet, it runs the
tests, tags the commit `vx.y.z`, creates the GitHub release with the artefacts and publishes to npm
through trusted publishing. Pushes without a new version stop after the check.

## License

Apache-2.0. The vendored specification files keep their licenses (`vendor/awp/LICENSE`,
`LICENSE-SPEC`). The browser bundle includes ajv (MIT), yaml (ISC) and @noble/hashes (MIT).

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. Compliance depends on the implementation,
organizational controls and applicable regulatory requirements.
