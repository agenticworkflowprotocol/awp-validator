// Static checks of step conditions (`when`, v1alpha4 spec 3.12): tokenizer and parser of the
// restricted condition grammar with its limits. Evaluation is the runtime's job; this module only
// decides whether a condition is well-formed and which paths it reads.
//
//   parseCondition(text) -> { ok: true, paths } | { ok: false, code, message }
//
// `paths` lists every path the condition reads: { root: 'inputs' | 'steps' | 'execution',
// name, stepId?, segments }.

export const CONDITION_LIMITS = Object.freeze({
  maxLength: 512,
  maxTokens: 128,
  maxDepth: 16,
  maxPathSegments: 16,
  maxListItems: 32,
  maxStringLength: 256,
  maxIndex: 10000,
});

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const COMPARISON_OPERATORS = new Set(['==', '!=', '<', '<=', '>', '>=', 'in']);
const KEYWORDS = new Set(['true', 'false', 'null', 'in', 'exists']);
const PUNCTUATION = ['&&', '||', '==', '!=', '<=', '>=', '<', '>', '!', '(', ')', '[', ']', ',', '.'];
const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/;
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*/;
const STRING_RE = /^"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/;

class ConditionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const syntaxError = message => new ConditionError('when.syntax', message);
const limitError = message => new ConditionError('when.limit-exceeded', message);

function readToken(text, pos) {
  const rest = text.slice(pos);
  let m;
  if ((m = STRING_RE.exec(rest))) {
    const value = JSON.parse(m[0]);
    if (value.length > CONDITION_LIMITS.maxStringLength) throw limitError(`string literal longer than ${CONDITION_LIMITS.maxStringLength} characters`);
    return { kind: 'string', value, length: m[0].length };
  }
  if (rest[0] === '"') throw syntaxError(`unterminated or invalid string at offset ${pos}`);
  if ((m = NUMBER_RE.exec(rest))) return { kind: 'number', value: Number(m[0]), text: m[0], length: m[0].length };
  if ((m = NAME_RE.exec(rest))) return { kind: KEYWORDS.has(m[0]) ? m[0] : 'name', value: m[0], length: m[0].length };
  const punct = PUNCTUATION.find(p => rest.startsWith(p));
  if (punct) return { kind: punct, value: punct, length: punct.length };
  throw syntaxError(`unexpected character "${rest[0]}" at offset ${pos}`);
}

/** Splits a condition into tokens; throws ConditionError. */
export function tokenize(text) {
  const tokens = [];
  let pos = 0;
  while (pos < text.length) {
    if (/\s/.test(text[pos])) { pos++; continue; }
    const token = readToken(text, pos);
    tokens.push({ ...token, pos });
    pos += token.length;
    if (tokens.length > CONDITION_LIMITS.maxTokens) throw limitError(`more than ${CONDITION_LIMITS.maxTokens} tokens`);
  }
  return tokens;
}

/** Recursive descent parser over the token list; collects the paths the condition reads. */
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
    this.depth = 0;
    this.paths = [];
  }

  peek() { return this.tokens[this.index]; }

  next() { return this.tokens[this.index++]; }

  expect(kind) {
    const token = this.next();
    if (token?.kind !== kind) throw syntaxError(`expected "${kind}" ${token ? `at offset ${token.pos}` : 'at the end'}`);
    return token;
  }

  accept(kind) {
    if (this.peek()?.kind !== kind) return false;
    this.index++;
    return true;
  }

  nested(parse) {
    if (++this.depth > CONDITION_LIMITS.maxDepth) throw limitError(`nesting deeper than ${CONDITION_LIMITS.maxDepth}`);
    parse();
    this.depth--;
  }

  parseCondition() {
    if (this.tokens.length === 0) throw syntaxError('empty condition');
    this.parseOr();
    const rest = this.peek();
    if (rest) throw syntaxError(`unexpected "${rest.value}" at offset ${rest.pos}`);
  }

  parseOr() {
    this.parseAnd();
    while (this.accept('||')) this.parseAnd();
  }

  parseAnd() {
    this.parseUnary();
    while (this.accept('&&')) this.parseUnary();
  }

  parseUnary() {
    if (this.accept('!')) return this.nested(() => this.parseUnary());
    this.parseOperand();
    if (COMPARISON_OPERATORS.has(this.peek()?.kind)) {
      this.next();
      this.parseOperand();
    }
  }

  parseOperand() {
    const token = this.peek();
    if (!token) throw syntaxError('unexpected end of condition');
    if (['string', 'number', 'true', 'false', 'null'].includes(token.kind)) return this.next();
    if (token.kind === '[') return this.parseList();
    if (token.kind === '(') return this.parseGroup();
    if (token.kind === 'exists') return this.parseExists();
    if (token.kind === 'name') return this.parsePath();
    throw syntaxError(`unexpected "${token.value}" at offset ${token.pos}`);
  }

  parseGroup() {
    this.expect('(');
    this.nested(() => this.parseOr());
    this.expect(')');
  }

  parseExists() {
    this.expect('exists');
    this.expect('(');
    this.parsePath();
    this.expect(')');
  }

  parseList() {
    this.expect('[');
    let items = 0;
    if (!this.accept(']')) {
      do {
        const token = this.next();
        if (!['string', 'number', 'true', 'false', 'null'].includes(token?.kind)) throw syntaxError('list items MUST be literals');
        if (++items > CONDITION_LIMITS.maxListItems) throw limitError(`list with more than ${CONDITION_LIMITS.maxListItems} items`);
      } while (this.accept(','));
      this.expect(']');
    }
  }

  /** A name after "." may also be a keyword (for example an output named `in`). */
  parseName() {
    const token = this.next();
    if (token?.kind !== 'name' && !KEYWORDS.has(token?.kind)) throw syntaxError(`expected a name ${token ? `at offset ${token.pos}` : 'at the end'}`);
    if (FORBIDDEN_SEGMENTS.has(token.value)) throw new ConditionError('when.forbidden-segment', `path segment "${token.value}" is not allowed`);
    return token.value;
  }

  parseDotName() {
    this.expect('.');
    return this.parseName();
  }

  parseRoot() {
    const root = this.parseName();
    if (root === 'inputs') return { root, name: this.parseDotName() };
    if (root === 'execution') {
      const name = this.parseDotName();
      if (name !== 'environment') throw new ConditionError('when.unknown-root', `execution.${name} is not readable in conditions; only execution.environment is`);
      return { root, name };
    }
    if (root === 'steps') {
      const stepId = this.parseDotName();
      if (this.parseDotName() !== 'outputs') throw syntaxError(`expected steps.${stepId}.outputs.<name>`);
      return { root, stepId, name: this.parseDotName() };
    }
    throw new ConditionError('when.unknown-root', `unknown root "${root}"; conditions read inputs, steps.<id>.outputs and execution.environment`);
  }

  parsePath() {
    const path = { ...this.parseRoot(), segments: [] };
    while (['.', '['].includes(this.peek()?.kind)) {
      path.segments.push(this.accept('.') ? this.parseName() : this.parseIndex());
      if (path.segments.length > CONDITION_LIMITS.maxPathSegments) throw limitError(`path with more than ${CONDITION_LIMITS.maxPathSegments} segments`);
    }
    this.paths.push(path);
  }

  parseIndex() {
    this.expect('[');
    const token = this.expect('number');
    if (!/^(0|[1-9]\d*)$/.test(token.text)) throw syntaxError(`index "${token.text}" is not a non-negative integer`);
    if (token.value > CONDITION_LIMITS.maxIndex) throw limitError(`index greater than ${CONDITION_LIMITS.maxIndex}`);
    this.expect(']');
    return token.value;
  }
}

/** Parses a condition. Returns { ok: true, paths } or { ok: false, code, message }. */
export function parseCondition(text) {
  try {
    if (text.length > CONDITION_LIMITS.maxLength) throw limitError(`condition longer than ${CONDITION_LIMITS.maxLength} characters`);
    const parser = new Parser(tokenize(text));
    parser.parseCondition();
    return { ok: true, paths: parser.paths };
  } catch (e) {
    if (!(e instanceof ConditionError)) throw e;
    return { ok: false, code: e.code, message: e.message };
  }
}

/**
 * Static rules of a step's `when` (v1alpha4 spec 3.12): it parses, steps.<id> is a direct or
 * transitive dependency with a declared output <name>, and inputs.<name> is declared (warning).
 * @param {{text: string, path: string, stepId: string, stepIds: Map, dependencies: Set<string>,
 *   outputsOf: Map<string, Set<string>>, inputNames: Set<string>, err: Function, warn: Function}} c
 */
export function checkStepCondition(c) {
  const parsed = parseCondition(c.text);
  if (!parsed.ok) return c.err(parsed.code, '3.12', c.path, `when: ${parsed.message}`);
  for (const p of parsed.paths) {
    if (p.root === 'inputs' && !c.inputNames.has(p.name)) {
      c.warn('when.undeclared-input', '3.12', c.path, `condition reads undeclared input "${p.name}"`);
    }
    if (p.root !== 'steps') continue;
    if (!c.stepIds.has(p.stepId)) c.err('when.unknown-step', '3.12', c.path, `condition reads non-existent step "${p.stepId}"`);
    else if (!c.dependencies.has(p.stepId)) c.err('when.not-a-dependency', '3.12', c.path, `step "${c.stepId}" reads steps.${p.stepId} in when but does not depend on it (directly or transitively)`);
    else if (!c.outputsOf.get(p.stepId).has(p.name)) c.err('when.undeclared-output', '3.12', c.path, `step "${p.stepId}" does not declare output "${p.name}"`);
  }
}
