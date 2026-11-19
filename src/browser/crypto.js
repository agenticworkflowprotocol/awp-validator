// Minimal stand-in for `node:crypto` in the browser bundle: the semantic rules of the
// specification only call createHash(alg).update(text, 'utf8').digest('hex') for manifest digests
// (spec 9.1). Web Crypto is asynchronous, so a synchronous SHA-2 implementation is used.
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

const ALGORITHMS = { sha256, sha384, sha512 };

export function createHash(algorithm) {
  const fn = ALGORITHMS[algorithm];
  if (!fn) throw new Error(`unsupported hash algorithm: ${algorithm}`);
  const chunks = [];
  const hash = {
    update(data) {
      chunks.push(typeof data === 'string' ? utf8ToBytes(data) : data);
      return hash;
    },
    digest(encoding) {
      if (encoding !== 'hex') throw new Error('only hex digests are supported');
      const total = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let offset = 0;
      for (const c of chunks) { total.set(c, offset); offset += c.length; }
      return bytesToHex(fn(total));
    },
  };
  return hash;
}
