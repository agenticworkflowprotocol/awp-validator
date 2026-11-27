// Node.js entry point: compiles the vendored JSON Schemas with Ajv once and exposes the validator.
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { createValidator } from './validator.js';
import { API_VERSION, API_VERSIONS } from './versions.js';

export { API_VERSION, API_VERSIONS, KNOWN_PROFILES, UsageError, resolveProfiles, summarize } from './validator.js';
export { jcs, manifestDigest } from '../vendor/awp/conformance/semantic.mjs';
export { migrateToV1alpha3, migrateToV1alpha4 } from '../vendor/awp/conformance/migrate.mjs';
export { formatDiagnostic, formatJson, formatText, isOk } from './format.js';

const vendor = new URL('../vendor/awp/', import.meta.url);

/** The AWP JSON Schemas (draft 2020-12) this validator uses, by API version. */
export const schemas = Object.fromEntries(API_VERSIONS.map((v) => [v, JSON.parse(readFileSync(new URL(`schema/awp.${v}.json`, vendor), 'utf8'))]));
/** The JSON Schema of the current draft (API_VERSION). */
export const schema = schemas[API_VERSION];
/** Commit and file hashes of the vendored specification artefacts. */
export const provenance = JSON.parse(readFileSync(new URL('PROVENANCE.json', vendor), 'utf8'));

// Same Ajv options as the reference checker of the specification repository. One instance holds
// all schemas; their $id differ by version.
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
const schemaValidators = Object.fromEntries(API_VERSIONS.map((v) => [v, ajv.compile(schemas[v])]));

export const { validateManifest, validateText } = createValidator({ schemaValidators });
