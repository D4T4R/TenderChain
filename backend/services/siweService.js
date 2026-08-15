const crypto = require('crypto');
const { SiweMessage, generateNonce } = require('siwe');
const AuthNonce = require('../models/AuthNonce');
const { HttpError } = require('../middleware/errorMiddleware');

/**
 * Sign-In With Ethereum (EIP-4361).
 *
 * Chosen over password authentication because every account in this system is
 * already keyed by a wallet address and every privileged action is a signed
 * transaction. A password would add a stealable credential without adding any
 * authority the wallet does not already have.
 *
 * Flow:
 *   1. Client requests a nonce for its address.
 *   2. Client signs an EIP-4361 message containing that nonce.
 *   3. Server verifies the signature, consumes the nonce, and issues tokens.
 */

const NONCE_TTL_MS = Number(process.env.SIWE_NONCE_TTL_MS || 5 * 60 * 1000);

// The domain the signed message must bind to. A signature for another site's
// domain must not be accepted here.
const EXPECTED_DOMAIN = process.env.SIWE_DOMAIN || 'localhost:3002';
const EXPECTED_URI = process.env.SIWE_URI || 'http://localhost:3002';
const EXPECTED_CHAIN_ID = Number(process.env.SIWE_CHAIN_ID || 1337);

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function assertAddress(walletAddress) {
  if (!walletAddress || !ADDRESS_RE.test(walletAddress)) {
    throw new HttpError(400, 'A valid Ethereum wallet address is required');
  }
  return walletAddress.toLowerCase();
}

/**
 * Issues a single-use nonce bound to the requesting address.
 */
async function createNonce(walletAddress) {
  const address = assertAddress(walletAddress);
  const nonce = generateNonce();

  await AuthNonce.create({
    nonce,
    walletAddress: address,
    expiresAt: new Date(Date.now() + NONCE_TTL_MS),
  });

  return {
    nonce,
    domain: EXPECTED_DOMAIN,
    uri: EXPECTED_URI,
    chainId: EXPECTED_CHAIN_ID,
    expiresAt: new Date(Date.now() + NONCE_TTL_MS).toISOString(),
    statement: 'Sign in to TenderChain. This does not cost gas.',
  };
}

/**
 * Atomically consumes a nonce.
 *
 * findOneAndUpdate is used rather than read-then-write so two concurrent
 * verifications of the same signature cannot both succeed.
 */
async function consumeNonce(nonce, walletAddress) {
  const record = await AuthNonce.findOneAndUpdate(
    {
      nonce,
      walletAddress,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { consumedAt: new Date() } },
    { new: true }
  );

  if (!record) {
    throw new HttpError(401, 'Nonce is unknown, already used, or expired');
  }

  return record;
}

/**
 * Verifies an EIP-4361 message and its signature.
 *
 * Returns the recovered, lowercased address on success.
 */
async function verifySignature({ message, signature }) {
  if (typeof message !== 'string' || typeof signature !== 'string') {
    throw new HttpError(400, 'message and signature are required');
  }

  let siwe;
  try {
    siwe = new SiweMessage(message);
  } catch {
    throw new HttpError(400, 'Malformed SIWE message');
  }

  // The nonce must be consumed against the address the message claims, before
  // the signature is trusted, so a failed verification still burns the nonce.
  const claimedAddress = assertAddress(siwe.address);
  await consumeNonce(siwe.nonce, claimedAddress);

  let result;
  try {
    result = await siwe.verify({
      signature,
      // Binding domain and nonce here makes the library reject a signature
      // produced for a different site or with a nonce we did not issue.
      domain: EXPECTED_DOMAIN,
      nonce: siwe.nonce,
    });
  } catch (error) {
    throw new HttpError(401, `Signature verification failed: ${error.message}`);
  }

  if (!result?.success) {
    throw new HttpError(401, 'Signature verification failed');
  }

  if (siwe.chainId !== EXPECTED_CHAIN_ID) {
    throw new HttpError(
      401,
      `Message is for chain ${siwe.chainId}, expected ${EXPECTED_CHAIN_ID}`
    );
  }

  // siwe validates expirationTime/notBefore itself, but the message need not
  // carry them; cap the age of an undated message independently.
  if (siwe.issuedAt) {
    const age = Date.now() - new Date(siwe.issuedAt).getTime();
    if (age > NONCE_TTL_MS) {
      throw new HttpError(401, 'Signed message is too old');
    }
  }

  return claimedAddress;
}

/**
 * Builds the canonical message the client should sign. Exposed so the frontend
 * and the tests construct identical messages.
 */
function buildMessage({ address, nonce, issuedAt }) {
  return new SiweMessage({
    domain: EXPECTED_DOMAIN,
    address,
    statement: 'Sign in to TenderChain. This does not cost gas.',
    uri: EXPECTED_URI,
    version: '1',
    chainId: EXPECTED_CHAIN_ID,
    nonce,
    issuedAt: issuedAt || new Date().toISOString(),
  });
}

module.exports = {
  createNonce,
  consumeNonce,
  verifySignature,
  buildMessage,
  assertAddress,
  EXPECTED_DOMAIN,
  EXPECTED_URI,
  EXPECTED_CHAIN_ID,
  NONCE_TTL_MS,
  // exported for tests
  _generateNonce: () => crypto.randomUUID(),
};
