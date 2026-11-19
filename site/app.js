// Validator page: runs the bundled validator locally; nothing leaves the browser.
import { KNOWN_PROFILES, formatJson, isOk, validateText } from './lib/awp-validator.mjs';

const SPEC_URL = 'https://agenticworkflowprotocol.org/specification/v1alpha1/';
const DEBOUNCE_MS = 300;
const STARTER = `apiVersion: awp.agenticworkflowprotocol.org/v1alpha1
kind: Workflow
metadata:
  name: hello-workflow
  version: 0.1.0
  owner:
    team: example-team
  classification: internal
spec:
  budget:
    maxCostUsd: 1.00
    maxSteps: 10
  agents:
    - id: helper
      model:
        provider: example-provider
        name: example-model
  workflow:
    - id: greet
      agent: helper
  permissions:
    default: deny
`;

const $ = (id) => document.getElementById(id);
const els = {
  form: $('form'), manifest: $('manifest'), example: $('example'), file: $('file'), profiles: $('profiles'),
  verifyDigest: $('verify-digest'), strict: $('strict'), status: $('status'), list: $('diagnostics'),
  jsonDetails: $('json-details'), json: $('json'), copy: $('copy-json'),
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

function renderProfiles() {
  for (const p of KNOWN_PROFILES) {
    const input = el('input', { type: 'checkbox', value: p, id: `profile-${p}` });
    input.checked = true;
    els.profiles.append(el('label', { for: `profile-${p}` }, input, ` ${p}`));
  }
}

const selectedProfiles = () => [...els.profiles.querySelectorAll('input:checked')].map((i) => i.value);

/** Move the caret to a 1-based line and column and scroll it into view. */
function jumpTo(line, column) {
  const lines = els.manifest.value.split('\n');
  const offset = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0) + Math.max(0, column - 1);
  els.manifest.focus();
  els.manifest.setSelectionRange(offset, offset);
  const lineHeight = parseFloat(getComputedStyle(els.manifest).lineHeight) || 20;
  els.manifest.scrollTop = Math.max(0, (line - 3) * lineHeight);
}

function diagnosticItem(d) {
  const src = d.source ?? {};
  const where = src.line
    ? el('button', { type: 'button', class: 'pos', title: 'Show in editor', onclick: () => jumpTo(src.line, src.column) }, `${src.line}:${src.column}`)
    : el('span', { class: 'pos' }, '–');
  const section = d.section ? el('a', { href: SPEC_URL, class: 'section', title: `Specification section ${d.section}` }, `spec ${d.section}`) : null;
  return el('li', { class: `diag ${d.severity}` },
    el('span', { class: 'sev' }, d.severity),
    where,
    el('div', { class: 'body' },
      el('div', { class: 'meta' }, el('code', {}, d.code), d.path ? el('code', { class: 'path' }, d.path) : null, section),
      el('p', {}, d.message)));
}

function render(file, options) {
  const files = [file];
  const ok = isOk(files, { strict: options.strict });
  const docs = file.documents;
  const errors = docs.flatMap((d) => d.diagnostics).filter((d) => d.severity === 'error').length;
  const warnings = docs.flatMap((d) => d.diagnostics).filter((d) => d.severity === 'warning').length;
  const label = docs.map((d) => [d.kind, d.name, d.version].filter(Boolean).join(' ')).filter(Boolean).join(', ');
  els.status.className = `status ${ok ? 'ok' : 'fail'}`;
  els.status.textContent = `${ok ? 'Valid' : 'Invalid'}${label ? ` – ${label}` : ''}: ${docs.length} document${docs.length === 1 ? '' : 's'}, ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}.`;
  els.list.replaceChildren(...docs.flatMap((d) => d.diagnostics).map(diagnosticItem));
  els.json.textContent = JSON.stringify(formatJson(files, { profiles: options.profiles, strict: options.strict }), null, 2);
  els.jsonDetails.hidden = false;
}

function validateNow() {
  const text = els.manifest.value;
  if (!text.trim()) {
    els.status.className = 'status';
    els.status.textContent = 'Paste a manifest or load an example.';
    els.list.replaceChildren();
    els.jsonDetails.hidden = true;
    return;
  }
  const profiles = selectedProfiles();
  if (!profiles.length) {
    els.status.className = 'status fail';
    els.status.textContent = 'Select at least one profile.';
    els.list.replaceChildren();
    return;
  }
  const options = { profiles, strict: els.strict.checked };
  const file = validateText(text, { file: 'manifest', profiles, verifyDigest: els.verifyDigest.checked });
  render(file, options);
}

let timer;
const validateSoon = () => { clearTimeout(timer); timer = setTimeout(validateNow, DEBOUNCE_MS); };

function load(text) {
  els.manifest.value = text;
  validateNow();
}

async function loadExamples() {
  try {
    const res = await fetch('examples/index.json');
    const { examples } = await res.json();
    for (const name of examples) els.example.append(el('option', { value: name }, name));
  } catch {
    els.example.disabled = true;
  }
}

els.example.addEventListener('change', async () => {
  if (!els.example.value) return;
  const res = await fetch(`examples/${encodeURIComponent(els.example.value)}`);
  load(await res.text());
});
els.file.addEventListener('change', async () => {
  const f = els.file.files?.[0];
  if (f) load(await f.text());
});
els.manifest.addEventListener('dragover', (e) => e.preventDefault());
els.manifest.addEventListener('drop', async (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  e.preventDefault();
  load(await f.text());
});
els.manifest.addEventListener('input', () => { els.example.value = ''; validateSoon(); });
els.form.addEventListener('change', (e) => { if (e.target !== els.example && e.target !== els.file) validateNow(); });
els.form.addEventListener('submit', (e) => { e.preventDefault(); validateNow(); });
els.copy.addEventListener('click', async () => {
  await navigator.clipboard.writeText(els.json.textContent);
  els.copy.textContent = 'Copied';
  setTimeout(() => { els.copy.textContent = 'Copy'; }, 1500);
});

renderProfiles();
loadExamples();
load(STARTER);
