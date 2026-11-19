# Changelog

All notable changes are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-19

### Added

- AWP `v1alpha2` (draft: `v1alpha1` plus step iteration, `forEach`) next to `v1alpha1`. Each
  document is validated against the schema of its own `apiVersion`; an unsupported version is
  checked against the latest schema and rejected at `/apiVersion`.
- `API_VERSIONS`, `schemas` (by version) and the exports `./schema/v1alpha1.json` and
  `./schema/v1alpha2.json`. Document results carry `awp`, the version they were validated as.

### Changed

- Vendored specification moved from `vendor/awp-v1alpha1/` to `vendor/awp/` (schemas and examples
  of every version, shared semantic rules and conformance suite) at specification commit
  `46f9e6a`; `PROVENANCE.json` lists `awpVersions` instead of `awpVersion`.
- `API_VERSION` and `schema` (and `./schema.json`) are now the latest version, `v1alpha2`.
- JSON output: `awp` is the version the documents were processed as, a list when they differ.
- `--version` lists all supported versions. The website picks examples of the latest version and
  links diagnostics to the specification of the document's version.

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
