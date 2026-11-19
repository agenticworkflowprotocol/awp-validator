// Browser entry point (bundled to dist/browser/awp-validator.mjs). Uses the JSON Schema validators
// that scripts/build.mjs precompiled with Ajv (one named export per API version), so the bundle
// needs no eval and works under a strict Content-Security-Policy. node:crypto is replaced by a
// synchronous SHA-2 shim at build time.
import * as schemaValidators from '../build/schema-validator.mjs';
import v1alpha1 from '../vendor/awp/schema/awp.v1alpha1.json';
import v1alpha2 from '../vendor/awp/schema/awp.v1alpha2.json';
import provenanceJson from '../vendor/awp/PROVENANCE.json';
import { createValidator } from './validator.js';
export { API_VERSION, API_VERSIONS, KNOWN_PROFILES, UsageError, resolveProfiles, summarize } from './validator.js';
export { jcs, manifestDigest } from '../vendor/awp/conformance/semantic.mjs';
export { formatDiagnostic, formatJson, formatText, isOk } from './format.js';
export const schemas = { v1alpha1, v1alpha2 };
export const schema = v1alpha2;
export const provenance = provenanceJson;
export const { validateManifest, validateText } = createValidator({ schemaValidators });
