# Changelog

All notable changes are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-11-27

### Added

- AWP `v1alpha4` (decision D23 of the specification): `v1alpha3` plus step
  conditions (`when`, spec 3.12) and workflow steps (`type: workflow`, spec 5.6.6), with the new
  diagnostics `when.syntax`, `when.limit-exceeded`, `when.forbidden-segment`, `when.unknown-root`,
  `when.unknown-step`, `when.not-a-dependency`, `when.undeclared-output`, `step.workflow-output`
  and the warning `when.undeclared-input`.
- `schemas.v1alpha4`, the export `./schema/v1alpha4.json` and `migrateToV1alpha4` (mechanical
  migration of `v1alpha1`, `v1alpha2` and `v1alpha3` manifests).
- Tests run the `v1alpha4` conformance suite and examples against the Node.js build and the
  browser bundle.

### Changed

- **Breaking:** `v1alpha4` is the current draft (decision D24 of the specification). `API_VERSION`,
  the default `schema` and the export `./schema.json` are now `v1alpha4`; an unsupported
  `apiVersion` is checked against `v1alpha4` and rejected at `/apiVersion`. Use
  `./schema/v1alpha3.json` or `schemas.v1alpha3` for the previous default.
- `v1alpha1`, `v1alpha2` and `v1alpha3` documents are validated exactly as before, against the
  schema of their own `apiVersion`. The vendored specification includes `conformance/conditions.mjs`
  and is updated to commit `058c267` (D23 merged); D24 changes no vendored schema or rule.
- The website starts with a `v1alpha4` manifest and shows the `v1alpha4` examples.

## [0.3.0] - 2026-11-25

### Changed

- **Breaking:** `v1alpha3` is the current draft (decision D22 of the specification). `API_VERSION`,
  the default `schema` and the export `./schema.json` are now `v1alpha3`; an unsupported
  `apiVersion` is checked against `v1alpha3` and rejected at `/apiVersion`. Use
  `./schema/v1alpha2.json` or `schemas.v1alpha2` for the previous default.
- `v1alpha1` and `v1alpha2` documents are validated exactly as before, against the schema of their
  own `apiVersion`; the vendored specification is updated to commit `c8f79b1` (D22 merged); schemas and semantic rules are unchanged.
- The website starts with a `v1alpha3` manifest and shows the `v1alpha3` examples.

## [0.2.0] - 2026-11-20

### Added

- AWP `v1alpha2` (draft: `v1alpha1` plus step iteration, `forEach`) and the proposed draft
  `v1alpha3` (`v1alpha2` aligned with the Kubernetes resource model: governance fields in `spec`,
  extension fields in `extensions`, `status`, kind `WorkflowRun`, step outputs, human input with
  the profile `interaction`). Each document is validated against the schema of its own
  `apiVersion`; an unsupported version is checked against the current draft and rejected at
  `/apiVersion`.
- `API_VERSIONS`, `schemas` (by version), the exports `./schema/v1alpha1.json`,
  `./schema/v1alpha2.json` and `./schema/v1alpha3.json`, and `migrateToV1alpha3` (mechanical
  migration of `v1alpha1` and `v1alpha2` manifests). Document results carry `awp`, the version
  they were validated as.
- Tests run the conformance suites of all three versions against the Node.js build and the browser
  bundle.

### Changed

- Vendored specification moved from `vendor/awp-v1alpha1/` to `vendor/awp/` (schemas, examples and
  conformance suites of every version, shared semantic rules) at specification commit `dc6fb3d`;
  `PROVENANCE.json` lists `awpVersions` instead of `awpVersion`.
- `API_VERSION` and `schema` (and `./schema.json`) are now the current draft, `v1alpha2`.
- JSON output: `awp` is the version the documents were processed as, a list when they differ.
- `--version` lists all supported versions. The website picks examples of the current draft and
  links diagnostics to the specification of the document's version.
- Schemas `v1alpha1` and `v1alpha2`: approval steps no longer accept `requiredFor` and
  `separationOfDuties` (specification erratum).

## [0.1.0] - 2026-11-19

### Added

- `awp validate` with the options, output formats and exit codes of the AWP CLI output formats
  (section 4): `--profiles`, `--verify-digest`, `--strict`, `--output text|json`, `--quiet`,
  standard input with `-`.
- Library for Node.js (`validateText`, `validateManifest`, formatters, `manifestDigest`, `jcs`,
  `schema`, `provenance`) with TypeScript types.
- Browser bundle without `eval` (precompiled JSON Schema validator, synchronous SHA-2 for digests).
- Website for validation in the browser (validator.agenticworkflowprotocol.org).
- Unchanged copy of the AWP `v1alpha1` schema, semantic rules, conformance suite and examples at
  specification commit `7b3f381`, verified by hash in the tests.
- Tests: the full conformance suite and the specification examples against the Node.js build and
  the browser bundle (identical diagnostics), CLI and library behaviour.

[0.2.0]: https://github.com/agenticworkflowprotocol/awp-validator/releases/tag/v0.2.0
[0.1.0]: https://github.com/agenticworkflowprotocol/awp-validator/releases/tag/v0.1.0
