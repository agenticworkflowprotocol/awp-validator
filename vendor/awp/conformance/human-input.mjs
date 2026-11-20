// Semantic rules for human input (v1alpha3 spec 5.8) that JSON Schema cannot express.

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

const matchesField = (field, value) => {
  if (field.type === 'string') return typeof value === 'string' && (!field.enum || field.enum.includes(value));
  if (field.type === 'integer') return Number.isInteger(value);
  if (field.type === 'number') return typeof value === 'number';
  return typeof value === 'boolean';
};

/** Whether a value is a valid answer for an input step: a string without schema, else an object. */
function matchesAnswer(answerSchema, value) {
  if (!answerSchema) return typeof value === 'string';
  if (!isObj(value)) return false;
  const fields = answerSchema.properties;
  if (Object.keys(value).some(k => !Object.hasOwn(fields, k))) return false;
  if ((answerSchema.required ?? []).some(k => !Object.hasOwn(value, k))) return false;
  return Object.entries(value).every(([k, v]) => matchesField(fields[k], v));
}

/**
 * Check the `input` object of an input step.
 * @param {object} input the step's `input`
 * @param {string[]} base JSON pointer parts of the step's `input`
 * @param {(code: string, section: string, path: string, message: string) => void} err
 * @param {(...parts: (string|number)[]) => string} ptr
 */
export function checkInputStep(input, base, err, ptr) {
  const schema = input.answerSchema;
  (schema?.required ?? []).forEach((name, j) => {
    if (!Object.hasOwn(schema.properties, name)) {
      err('input.required-unknown-field', '5.8', ptr(...base, 'answerSchema', 'required', j), `required names "${name}", which is not a field of answerSchema.properties`);
    }
  });
  for (const [name, field] of Object.entries(schema?.properties ?? {})) {
    if (field.enum && field.type !== 'string') {
      err('input.enum-not-string', '5.8', ptr(...base, 'answerSchema', 'properties', name, 'enum'), 'enum is only allowed for fields of type string');
    }
  }
  if (input.default !== undefined && !matchesAnswer(schema, input.default)) {
    err('input.default-mismatch', '5.8', ptr(...base, 'default'), schema ? 'default does not match answerSchema' : 'default MUST be a string when answerSchema is absent');
  }
}
