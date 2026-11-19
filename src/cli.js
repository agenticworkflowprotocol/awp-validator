// `awp validate` with the options, streams and exit codes of the AWP CLI output formats
// (docs/cli.md in the specification repository, sections 1, 2 and 4).
import { readFileSync } from 'node:fs';
import { API_VERSION, KNOWN_PROFILES, UsageError, provenance, resolveProfiles, validateText } from './index.js';
import { formatJson, formatText, isOk } from './format.js';

export const EXIT = { OK: 0, CHECK_FAILED: 1, USAGE: 2, CANNOT_WORK: 3 };

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const HELP = `Usage: awp validate [options] <manifest>...

Validate AWP manifests (YAML or JSON; "-" reads standard input).

Options:
  --profiles <list>     Supported conformance profiles, comma-separated
                        (${KNOWN_PROFILES.join(', ')}). Default: all.
  --verify-digest       Verify metadata.integrity.digest (spec 9.1).
  --strict              Treat warnings as errors (exit code only).
  --output text|json    Output format. Default: text.
  --quiet               Print only diagnostics of severity error.
  --no-color, --no-unicode
                        Accepted for compatibility; the output uses neither.
  --version             Print the version and the supported AWP API versions.
  --help                Print this help.

Exit codes: 0 valid, 1 invalid, 2 usage error, 3 file could not be read.`;

function parseArgs(argv) {
  const opts = { files: [], output: 'text', strict: false, quiet: false, verifyDigest: false, profiles: undefined };
  const takeValue = (i, name) => {
    const v = argv[i + 1];
    if (v === undefined || (v.startsWith('--') && v !== '-')) throw new UsageError(`${name} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profiles') opts.profiles = resolveProfiles(takeValue(i++, a));
    else if (a.startsWith('--profiles=')) opts.profiles = resolveProfiles(a.slice('--profiles='.length));
    else if (a === '--output') opts.output = takeValue(i++, a);
    else if (a.startsWith('--output=')) opts.output = a.slice('--output='.length);
    else if (a === '--verify-digest') opts.verifyDigest = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--no-color' || a === '--no-unicode') continue;
    else if (a === '-' || !a.startsWith('-')) opts.files.push(a);
    else throw new UsageError(`unknown option: ${a}`);
  }
  if (!['text', 'json'].includes(opts.output)) throw new UsageError(`unsupported output format: ${opts.output} (text, json)`);
  if (!opts.files.length) throw new UsageError('no manifest given');
  opts.profiles ??= resolveProfiles(undefined);
  return opts;
}

/**
 * Run the CLI.
 * @param {string[]} argv arguments after the program name
 * @param {{ stdout?: (s: string) => void, stderr?: (s: string) => void, readFile?: (f: string) => string }} [io]
 * @returns {number} exit code
 */
export function main(argv, io = {}) {
  const stdout = io.stdout ?? ((s) => process.stdout.write(s));
  const stderr = io.stderr ?? ((s) => process.stderr.write(s));
  const readFile = io.readFile ?? ((f) => readFileSync(f === '-' ? 0 : f, 'utf8'));

  const [command, ...rest] = argv;
  if (command === '--help' || command === '-h' || command === 'help' || (command === 'validate' && rest.includes('--help'))) {
    stdout(`${HELP}\n`);
    return EXIT.OK;
  }
  if (command === '--version') {
    stdout(`awp-validator ${pkg.version} (AWP ${API_VERSION}, specification ${provenance.source.commit.slice(0, 7)})\n`);
    return EXIT.OK;
  }
  if (command !== 'validate') {
    stderr(`${command ? `unknown command: ${command}` : 'no command given'}\n\n${HELP}\n`);
    return EXIT.USAGE;
  }

  let opts;
  try {
    opts = parseArgs(rest);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    stderr(`awp validate: ${err.message}\n`);
    return EXIT.USAGE;
  }

  const files = [];
  for (const file of opts.files) {
    let text;
    try {
      text = readFile(file);
    } catch (err) {
      stderr(`awp validate: cannot read ${file}: ${err.code ?? err.message}\n`);
      return EXIT.CANNOT_WORK;
    }
    files.push(validateText(text, { file: file === '-' ? '<stdin>' : file, profiles: opts.profiles, verifyDigest: opts.verifyDigest }));
  }

  if (opts.output === 'json') stdout(`${JSON.stringify(formatJson(files, { profiles: opts.profiles, strict: opts.strict }), null, 2)}\n`);
  else {
    const text = formatText(files, { quiet: opts.quiet });
    if (text) stdout(`${text}\n`);
  }
  return isOk(files, { strict: opts.strict }) ? EXIT.OK : EXIT.CHECK_FAILED;
}
