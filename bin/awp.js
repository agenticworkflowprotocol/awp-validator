#!/usr/bin/env node
import { main } from '../src/cli.js';

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  // Internal error: exit code 3 (the command could not do its work), no stack trace for users.
  process.stderr.write(`awp: internal error: ${err.message}\n`);
  process.exitCode = 3;
}
