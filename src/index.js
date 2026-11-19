// Node.js entry point: compiles the vendored JSON Schema with Ajv once and exposes the validator.
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { createValidator } from './validator.js';

export { API_VERSION, KNOWN_PROFILES, UsageError, resolveProfiles, summarize } from './validator.js';
export { jcs, manifestDigest } from '../vendor/awp-v1alpha1/conformance/semantic.mjs';
export { formatDiagnostic, formatJson, formatText, isOk } from './format.js';

const vendor = new URL('../vendor/awp-v1alpha1/', import.meta.url);

/** The AWP v1alpha1 JSON Schema (draft 2020-12) this validator uses. */
export const schema = JSON.parse(readFileSync(new URL('schema/awp.v1alpha1.json', vendor), 'utf8'));
/** Commit and file hashes of the vendored specification artefacts. */
export const provenance = JSON.parse(readFileSync(new URL('PROVENANCE.json', vendor), 'utf8'));

// Same Ajv options as the reference checker of the specification repository.
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });

export const { validateManifest, validateText } = createValidator({ validateSchema: ajv.compile(schema) });
