# Changelog

All notable changes are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/agenticworkflowprotocol/awp-validator/releases/tag/v0.1.0
