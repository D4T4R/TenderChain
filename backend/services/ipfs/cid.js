const crypto = require('crypto');

/**
 * CIDv1 construction for raw content hashed with sha2-256.
 *
 * Implemented directly rather than via the multiformats package, which is
 * ESM-only: importing it dynamically from this CommonJS codebase segfaulted
 * under Jest's module registry. The encoding for this one case is small,
 * fully specified and stable, so depending on a package here bought fragility
 * rather than safety.
 *
 * Layout, following the CID spec:
 *
 *   multihash = <0x12 sha2-256><0x20 length><32-byte digest>
 *   cid       = <0x01 version><0x55 raw codec><multihash>
 *   text      = "b" + base32(cid), lower case, unpadded  (multibase)
 *
 * Only this combination is produced. Anything else - a different hash, a
 * dag-pb tree for large files - must go through a real IPFS node, which is
 * what the kubo driver is for.
 */

const SHA2_256 = 0x12;
const DIGEST_LENGTH = 0x20;
const CID_VERSION_1 = 0x01;
const CODEC_RAW = 0x55;

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** RFC 4648 base32, lower case, no padding - multibase 'b'. */
function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * @param {Buffer} content
 * @returns {string} CIDv1, e.g. bafkrei...
 */
function computeCid(content) {
  const digest = crypto.createHash('sha256').update(content).digest();

  const multihash = Buffer.concat([
    Buffer.from([SHA2_256, DIGEST_LENGTH]),
    digest,
  ]);
  const cid = Buffer.concat([
    Buffer.from([CID_VERSION_1, CODEC_RAW]),
    multihash,
  ]);

  return `b${base32Encode(cid)}`;
}

module.exports = { computeCid, base32Encode };
