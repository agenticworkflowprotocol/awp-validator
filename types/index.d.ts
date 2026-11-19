// Types of @agenticworkflowprotocol/validator (Node.js entry and the `./browser` entry).

/** Conformance profiles of AWP (spec 11.2; the same in v1alpha1 and v1alpha2). */
export type ApiVersion = 'v1alpha1' | 'v1alpha2';
export type Profile = 'core' | 'governance' | 'audit' | 'security' | 'mcp' | 'a2a';

/** A finding, as in the AWP CLI output formats, section 3. */
export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  /** Stable code, for example `schema.additionalProperties` or `dependsOn.unknown-step`. */
  code: string;
  message: string;
  /** RFC 6901 JSON Pointer into the document; `""` for the whole document. */
  path: string;
  /** Section of the specification that states the rule, for example `5.6.3`. */
  section?: string;
  /** Zero-based index of the document within the file. */
  document?: number;
  source?: { file: string; line?: number; column?: number };
  hint?: string;
}

export interface ManifestResult {
  kind?: string;
  name?: string;
  version?: string;
  /** API version the document was validated as: its `apiVersion`, or the latest when that is not supported. Absent when the document could not be parsed. */
  awp?: ApiVersion;
  valid: boolean;
  diagnostics: Diagnostic[];
}

export interface DocumentResult extends ManifestResult {
  document: number;
}

export interface FileResult {
  file: string;
  documents: DocumentResult[];
}

export interface ValidateOptions {
  /** Profiles treated as supported; fields of other profiles are rejected. Default: all. */
  profiles?: Profile[] | string;
  /** Verify `metadata.integrity.digest` (spec 9.1). */
  verifyDigest?: boolean;
}

/** Validate every document of a YAML or JSON text, with line and column of each diagnostic. */
export function validateText(text: string, options?: ValidateOptions & { file?: string }): FileResult;

/** Validate an already parsed manifest (no positions). */
export function validateManifest(value: unknown, options?: ValidateOptions): ManifestResult;

export interface Summary {
  documents: number;
  valid: number;
  invalid: number;
  errors: number;
  warnings: number;
}
export function summarize(files: FileResult[]): Summary;

/** Normalise a profile list; throws `UsageError` for unknown profiles. */
export function resolveProfiles(profiles?: Profile[] | string): Profile[];
export class UsageError extends Error {}

/** JSON Canonicalization Scheme (RFC 8785) for manifest values. */
export function jcs(value: unknown): string;
/** Manifest digest of spec 9.1, for example `sha256:…`. */
export function manifestDigest(manifest: unknown, algorithm?: 'sha256' | 'sha384' | 'sha512'): string;

/** Supported API versions, oldest first. */
export const API_VERSIONS: ApiVersion[];
/** The latest supported API version. */
export const API_VERSION: ApiVersion;
export const KNOWN_PROFILES: Profile[];
/** The AWP JSON Schemas (draft 2020-12) used by the validator, by API version. */
export const schemas: Record<ApiVersion, Record<string, unknown>>;
/** The JSON Schema of the latest supported API version. */
export const schema: Record<string, unknown>;
/** Commit and file hashes of the vendored specification artefacts. */
export const provenance: {
  awpVersions: ApiVersion[];
  source: { repository: string; commit: string; commitDate: string };
  files: { path: string; sha256: string }[];
};

// Output formats of `awp validate` (docs/cli.md of the specification, sections 3 and 4).
export function formatDiagnostic(diagnostic: Diagnostic): string;
export function formatText(files: FileResult[], options?: { quiet?: boolean }): string;
export function formatJson(files: FileResult[], options?: { profiles?: Profile[]; strict?: boolean }): {
  /** API version the documents were processed as; a list when they differ. */
  awp: ApiVersion | ApiVersion[];
  command: 'validate';
  ok: boolean;
  result: { profiles?: Profile[]; files: FileResult[]; summary: Summary };
};
export function isOk(files: FileResult[], options?: { strict?: boolean }): boolean;
