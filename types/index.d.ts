// Types of @agenticworkflowprotocol/validator (Node.js entry and the `./browser` entry).

/** Conformance profiles of AWP v1alpha1 (spec 11.2). */
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

export const API_VERSION: 'v1alpha1';
export const KNOWN_PROFILES: Profile[];
/** The AWP JSON Schema (draft 2020-12) used by the validator. */
export const schema: Record<string, unknown>;
/** Commit and file hashes of the vendored specification artefacts. */
export const provenance: {
  awpVersion: string;
  source: { repository: string; commit: string; commitDate: string };
  files: { path: string; sha256: string }[];
};

// Output formats of `awp validate` (docs/cli.md of the specification, sections 3 and 4).
export function formatDiagnostic(diagnostic: Diagnostic): string;
export function formatText(files: FileResult[], options?: { quiet?: boolean }): string;
export function formatJson(files: FileResult[], options?: { profiles?: Profile[]; strict?: boolean }): {
  awp: 'v1alpha1';
  command: 'validate';
  ok: boolean;
  result: { profiles?: Profile[]; files: FileResult[]; summary: Summary };
};
export function isOk(files: FileResult[], options?: { strict?: boolean }): boolean;
