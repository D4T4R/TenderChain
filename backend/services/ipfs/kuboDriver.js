const logger = require('../../utils/logger');

/**
 * kubo (go-ipfs) driver, talking to a node's RPC API.
 *
 * Replaces ipfs-http-client, which this project depended on but never called
 * and which is deprecated upstream in favour of kubo-rpc-client.
 *
 * kubo-rpc-client is ESM-only, so it is loaded with a dynamic import from this
 * CommonJS codebase rather than require().
 */

const API_URL = () => process.env.IPFS_API_URL || 'http://127.0.0.1:5001';

let clientPromise;

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { create } = await import('kubo-rpc-client');
      return create({ url: API_URL() });
    })();
  }
  return clientPromise;
}

function unavailable(error) {
  const wrapped = new Error(
    `IPFS node at ${API_URL()} is unreachable: ${error.message}`
  );
  wrapped.code = 'IPFS_UNAVAILABLE';
  return wrapped;
}

module.exports = {
  async add(content, { filename } = {}) {
    try {
      const client = await getClient();
      // cidVersion 1 and raw leaves keep the CID stable and comparable with
      // what the in-memory driver and any pinning service produce.
      const result = await client.add(
        { content, path: filename },
        { cidVersion: 1, rawLeaves: true, pin: true }
      );
      return { cid: result.cid.toString(), size: result.size };
    } catch (error) {
      throw unavailable(error);
    }
  },

  async cat(cid) {
    try {
      const client = await getClient();
      const chunks = [];
      for await (const chunk of client.cat(cid)) chunks.push(chunk);
      return Buffer.concat(chunks);
    } catch (error) {
      throw unavailable(error);
    }
  },

  async hashOnly(content) {
    try {
      const client = await getClient();
      const result = await client.add(
        { content },
        { cidVersion: 1, rawLeaves: true, onlyHash: true }
      );
      return result.cid.toString();
    } catch (error) {
      throw unavailable(error);
    }
  },

  async pin(cid) {
    try {
      const client = await getClient();
      await client.pin.add(cid);
      return { cid, pinned: true };
    } catch (error) {
      // A failed pin is worth knowing about but does not invalidate the CID;
      // the content is still addressable if some other node holds it.
      logger.warn(`Failed to pin ${cid}: ${error.message}`);
      return { cid, pinned: false, error: error.message };
    }
  },

  async isAvailable() {
    try {
      const client = await getClient();
      await client.version();
      return true;
    } catch {
      return false;
    }
  },

  reset() {
    clientPromise = undefined;
  },
};
