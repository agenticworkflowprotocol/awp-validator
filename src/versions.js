// AWP API versions this validator supports. Each has a schema (vendor/awp/schema/awp.<v>.json),
// examples (vendor/awp/spec/<v>/examples) and a conformance suite (vendor/awp/conformance/ for
// v1alpha1, vendor/awp/conformance/<v>/ for later versions); the semantic rules are shared.

/** Supported API versions, oldest first. */
export const API_VERSIONS = ['v1alpha1', 'v1alpha2', 'v1alpha3', 'v1alpha4'];

/**
 * The current draft (decision D24 of the specification): the default schema export, the version an
 * unsupported apiVersion is checked against, and the examples of the website.
 */
export const API_VERSION = 'v1alpha4';

const API_GROUP = 'awp.agenticworkflowprotocol.org/';

/**
 * The API version a document is validated as: its own `apiVersion` when supported, otherwise the
 * current draft, whose schema then rejects the document at `/apiVersion` (spec 3.2).
 * @param {unknown} value parsed manifest
 * @returns {string} for example `v1alpha2`
 */
export function versionOf(value) {
  const apiVersion = value && typeof value === 'object' ? value.apiVersion : undefined;
  const short = typeof apiVersion === 'string' && apiVersion.startsWith(API_GROUP) ? apiVersion.slice(API_GROUP.length) : null;
  return API_VERSIONS.includes(short) ? short : API_VERSION;
}
