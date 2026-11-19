// Browser entry point (bundled to dist/browser/awp-validator.mjs). Uses the JSON Schema validator
// that scripts/build.mjs precompiled with Ajv, so the bundle needs no eval and works under a strict
// Content-Security-Policy. node:crypto is replaced by a synchronous SHA-2 shim at build time.
import validateSchema from '../build/schema-validator.mjs';
import schemaJson from '../vendor/awp-v1alpha1/schema/awp.v1alpha1.json';
import provenanceJson from '../vendor/awp-v1alpha1/PROVENANCE.json';
import { createValidator } from './validator.js';

export { API_VERSION, KNOWN_PROFILES, UsageError, resolveProfiles, summarize } from './validator.js';
export { jcs, manifestDigest } from '../vendor/awp-v1alpha1/conformance/semantic.mjs';
export { formatDiagnostic, formatJson, formatText, isOk } from './format.js';

export const schema = schemaJson;
export const provenance = provenanceJson;
export const { validateManifest, validateText } = createValidator({ validateSchema });
