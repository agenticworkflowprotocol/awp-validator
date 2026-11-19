// AWP API versions this validator supports. Each has a schema (vendor/awp/schema/awp.<v>.json)
// and examples (vendor/awp/spec/<v>/examples); semantic rules and conformance suite are shared.

/** Supported API versions, oldest first. */
export const API_VERSIONS = ['v1alpha1', 'v1alpha2'];
/** The latest supported API version. */
export const API_VERSION = API_VERSIONS.at(-1);

const API_GROUP = 'awp.agenticworkflowprotocol.org/';

/**
 * The API version a document is validated as: its own `apiVersion` when supported, otherwise the
 * latest, whose schema then rejects the document at `/apiVersion` (spec 3.2).
 * @param {unknown} value parsed manifest
 * @returns {string} for example `v1alpha2`
 */
export function versionOf(value) {
  const apiVersion = value && typeof value === 'object' ? value.apiVersion : undefined;
  const short = typeof apiVersion === 'string' && apiVersion.startsWith(API_GROUP) ? apiVersion.slice(API_GROUP.length) : null;
  return API_VERSIONS.includes(short) ? short : API_VERSION;
}
