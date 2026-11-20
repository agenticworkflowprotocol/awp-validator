// Validation of AWP manifests in three layers (spec 3.1, JSON Schema, semantic rules), independent
// of how the JSON Schema validator is created: Node.js compiles it at load time, the browser build
// uses a precompiled one (no eval). Results follow the diagnostics of the AWP CLI output formats,
// section 3 (docs/cli.md in the specification repository).
import { KNOWN_PROFILES, semanticCheck } from '../vendor/awp/conformance/semantic.mjs';
import { versionOf } from './versions.js';
import { loadDocuments, positionAt, positionOf } from './yaml.js';

export { API_VERSION, API_VERSIONS } from './versions.js';
export { KNOWN_PROFILES };

/** Thrown for invalid options (CLI exit code 2). */
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

const escapePointer = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');

/** Normalise `profiles`; unknown names are a usage error. */
export function resolveProfiles(profiles) {
  if (profiles === undefined) return [...KNOWN_PROFILES];
  const list = Array.isArray(profiles) ? profiles : String(profiles).split(',');
  const cleaned = [...new Set(list.map((p) => String(p).trim()).filter(Boolean))];
  const unknown = cleaned.filter((p) => !KNOWN_PROFILES.includes(p));
  if (unknown.length) throw new UsageError(`unknown profile: ${unknown.join(', ')} (known: ${KNOWN_PROFILES.join(', ')})`);
  if (!cleaned.length) throw new UsageError('profiles must name at least one profile');
  return cleaned;
}

function schemaDiagnostics(errors) {
  const out = [];
  const seen = new Set();
  for (const e of errors ?? []) {
    if (e.keyword === 'if') continue;
    let path = e.instancePath;
    if (e.keyword === 'additionalProperties') path += `/${escapePointer(e.params.additionalProperty)}`;
    if (e.keyword === 'propertyNames') path += `/${escapePointer(e.params.propertyName)}`;
    const allowed = e.params?.allowedValues ? ` (${e.params.allowedValues.join(', ')})` : '';
    const message = `${e.message}${allowed}`;
    const key = `${e.keyword}|${path}|${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ severity: 'error', code: `schema.${e.keyword}`, message, path });
  }
  return out;
}

/** Diagnostic in the field order of the CLI format; drops empty optional fields. */
function diagnostic({ severity, code, message, path, section }, extra = {}) {
  return { severity, code, message, path: path ?? '', ...(section ? { section } : {}), ...extra };
}

function identity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const meta = value.metadata && typeof value.metadata === 'object' ? value.metadata : {};
  const spec = value.spec && typeof value.spec === 'object' ? value.spec : {};
  // From v1alpha3 on the version is a spec field (Kubernetes resource model, spec 4.2).
  const version = versionOf(value) === 'v1alpha3' ? spec.version : meta.version;
  return {
    ...(typeof value.kind === 'string' ? { kind: value.kind } : {}),
    ...(typeof meta.name === 'string' ? { name: meta.name } : {}),
    ...(typeof version === 'string' ? { version } : {}),
  };
}

const countBy = (diagnostics, severity) => diagnostics.filter((d) => d.severity === severity).length;

/**
 * @param {{ schemaValidators: Record<string, ((value: unknown) => boolean) & { errors?: object[] | null }> }} deps
 *   one compiled JSON Schema per API version (`v1alpha1`, `v1alpha2`, ...)
 */
export function createValidator({ schemaValidators }) {
  /**
   * Validate an already parsed manifest (no positions). The schema is chosen by `apiVersion`
   * (`awp` in the result); an unsupported version is checked against the current draft.
   * @param {unknown} value
   * @param {{ profiles?: string[] | string, verifyDigest?: boolean }} [options]
   */
  function validateManifest(value, options = {}) {
    const profiles = resolveProfiles(options.profiles);
    const awp = versionOf(value);
    const validateSchema = schemaValidators[awp];
    if (!validateSchema(value)) {
      // The semantic rules assume a structurally valid document.
      const diagnostics = schemaDiagnostics(validateSchema.errors).map((d) => diagnostic(d));
      return { ...identity(value), awp, valid: false, diagnostics };
    }
    const diagnostics = semanticCheck(value, { profiles, verifyDigest: !!options.verifyDigest }).map((d) => diagnostic(d));
    return { ...identity(value), awp, valid: countBy(diagnostics, 'error') === 0, diagnostics };
  }

  /**
   * Validate every document of a YAML or JSON text.
   * @param {string} text
   * @param {{ file?: string, profiles?: string[] | string, verifyDigest?: boolean }} [options]
   */
  function validateText(text, options = {}) {
    const profiles = resolveProfiles(options.profiles);
    const file = options.file ?? '<input>';
    const loaded = loadDocuments(text);
    if (!loaded.length) {
      const d = diagnostic({ severity: 'error', code: 'yaml.empty', message: 'no document found', path: '', section: '3.1' }, { document: 0, source: { file } });
      return { file, documents: [{ document: 0, valid: false, diagnostics: [d] }] };
    }
    const documents = loaded.map(({ doc, value, diagnostics: yamlDiagnostics, lineCounter }, index) => {
      const at = (d) => {
        const pos = d.pos !== undefined ? positionAt(lineCounter, d.pos) : positionOf(doc, lineCounter, d.path);
        return diagnostic(d, { document: index, source: { file, ...(pos ?? {}) } });
      };
      if (value === undefined) return { document: index, valid: false, diagnostics: yamlDiagnostics.map(at) };
      const result = validateManifest(value, { profiles, verifyDigest: options.verifyDigest });
      return { document: index, ...result, diagnostics: result.diagnostics.map(at) };
    });
    return { file, documents };
  }

  return { validateManifest, validateText };
}

/** Totals over file results, as in the `summary` of `awp validate --output json`. */
export function summarize(files) {
  const documents = files.flatMap((f) => f.documents);
  const diagnostics = documents.flatMap((d) => d.diagnostics);
  return {
    documents: documents.length,
    valid: documents.filter((d) => d.valid).length,
    invalid: documents.filter((d) => !d.valid).length,
    errors: countBy(diagnostics, 'error'),
    warnings: countBy(diagnostics, 'warning'),
  };
}
