const { computeCid } = require('./cid');

/**
 * In-memory IPFS driver.
 *
 * Computes real CIDv1 values using the same hashing the network uses, so
 * content addressing is exercised honestly in tests and offline development -
 * only the storage and distribution are fake. A stub that returned fabricated
 * identifiers would let a CID-verification bug pass unnoticed.
 */

const store = new Map();

module.exports = {
  async add(content) {
    const cid = computeCid(content);
    store.set(cid, Buffer.from(content));
    return { cid, size: content.length };
  },

  async cat(cid) {
    const content = store.get(cid);
    if (!content) {
      const error = new Error(`CID not found: ${cid}`);
      error.code = 'IPFS_NOT_FOUND';
      throw error;
    }
    return content;
  },

  async hashOnly(content) {
    return computeCid(content);
  },

  async pin(cid) {
    // Everything held here is already "pinned" for the life of the process.
    return { cid, pinned: store.has(cid) };
  },

  async isAvailable() {
    return true;
  },

  reset() {
    store.clear();
  },
};
