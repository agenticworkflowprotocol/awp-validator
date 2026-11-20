// Migration of AWP manifests from v1alpha1 or v1alpha2 to v1alpha3 (Kubernetes resource model
// alignment). v1alpha2 has the layout of v1alpha1 plus forEach, which carries over unchanged.
// Pure function on parsed documents; the CLI wrapper is `awp-check.mjs migrate`.

const V1ALPHA1 = 'awp.agenticworkflowprotocol.org/v1alpha1';
const V1ALPHA2 = 'awp.agenticworkflowprotocol.org/v1alpha2';
const V1ALPHA3 = 'awp.agenticworkflowprotocol.org/v1alpha3';

// Fields that leave metadata, in the order they are placed at the start of spec.
const GOVERNANCE_FIELDS = ['version', 'description', 'owner', 'classification', 'purpose', 'risk', 'integrity', 'signature', 'provenance'];
const METADATA_FIELDS = ['name', 'namespace', 'labels', 'annotations'];

// Values whose keys are data, not field names: never scanned for extension fields.
const OPAQUE_FIELDS = new Set(['default', 'enum', 'filter', 'env', 'labels', 'annotations', 'extensions']);
// Maps whose values are objects with fields: the map keys are data, the values are scanned.
const MAP_FIELDS = new Set(['actionGroups', 'environments', 'tools']);

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Move x- fields of every object into an `extensions` field of the same object. */
function liftExtensions(node) {
  if (Array.isArray(node)) return node.map(liftExtensions);
  if (!isObj(node)) return node;
  const out = {};
  const extensions = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('x-')) extensions[key] = value;
    else if (OPAQUE_FIELDS.has(key)) out[key] = value;
    else if (MAP_FIELDS.has(key) && isObj(value)) out[key] = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, liftExtensions(v)]));
    else out[key] = liftExtensions(value);
  }
  if (Object.keys(extensions).length) out.extensions = { ...(node.extensions ?? {}), ...extensions };
  return out;
}

/** Policy conditions: a plain value becomes an `equals` operator. */
function migrateRules(rules) {
  return rules.map(rule => {
    if (!isObj(rule) || !isObj(rule.when)) return rule;
    const when = Object.fromEntries(Object.entries(rule.when).map(([attr, v]) => [attr, isObj(v) ? v : { equals: v }]));
    return { ...rule, when };
  });
}

/**
 * Migrate one parsed v1alpha1 or v1alpha2 manifest. Returns { document, notes }; `notes` lists changes an
 * author should review (for example a name that is not a DNS-1123 label).
 */
export function migrateToV1alpha3(doc) {
  if (!isObj(doc) || ![V1ALPHA1, V1ALPHA2].includes(doc.apiVersion)) {
    throw new Error(`expected apiVersion ${V1ALPHA1} or ${V1ALPHA2}`);
  }
  const notes = [];
  const lifted = liftExtensions(doc);
  const meta = lifted.metadata ?? {};
  const governance = {};
  for (const f of GOVERNANCE_FIELDS) if (meta[f] !== undefined) governance[f] = meta[f];
  if (typeof governance.owner === 'string') governance.owner = { team: governance.owner };

  const metadata = {};
  for (const f of METADATA_FIELDS) if (meta[f] !== undefined) metadata[f] = meta[f];
  if (meta.extensions) notes.push('metadata extension fields moved to spec.extensions; consider annotations');
  if (typeof metadata.name === 'string' && !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(metadata.name)) {
    notes.push(`metadata.name "${metadata.name}" is not a DNS-1123 label; rename it`);
  }

  const spec = { ...governance, ...(lifted.spec ?? {}) };
  const extensions = { ...(lifted.extensions ?? {}), ...(meta.extensions ?? {}), ...(spec.extensions ?? {}) };
  delete spec.extensions;
  if (Object.keys(extensions).length) spec.extensions = extensions;
  if (lifted.kind === 'Policy' && Array.isArray(spec.rules)) spec.rules = migrateRules(spec.rules);

  return { document: { apiVersion: V1ALPHA3, kind: lifted.kind, metadata, spec }, notes };
}
