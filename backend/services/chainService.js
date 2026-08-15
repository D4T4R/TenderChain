const { ethers } = require('ethers');
const logger = require('../utils/logger');

/**
 * Read-only access to the deployed contracts.
 *
 * Used by requireOnChainRole so the API can check authority against the
 * registries rather than trusting the role recorded in MongoDB.
 *
 * Only the AccessControl surface is needed here, so a minimal ABI is used
 * instead of importing the full artifacts.
 */

const ACCESS_CONTROL_ABI = [
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function REGISTRAR_ROLE() view returns (bytes32)',
  'function VERIFIER_ROLE() view returns (bytes32)',
  'function STATUS_UPDATER_ROLE() view returns (bytes32)',
  'function SLASHER_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
];

const CONTRACT_ADDRESS_ENV = {
  TenderRepo: 'TENDER_REPO_ADDRESS',
  ContractRepo: 'CONTRACT_REPO_ADDRESS',
  ContractorRepo: 'CONTRACTOR_REPO_ADDRESS',
  GovernmentOfficerRepo: 'GOVERNMENT_OFFICER_REPO_ADDRESS',
  StakeManager: 'STAKE_MANAGER_ADDRESS',
};

let provider;
const contractCache = new Map();

function getProvider() {
  if (!provider) {
    const url = process.env.WEB3_PROVIDER_URL || 'http://127.0.0.1:8545';
    provider = new ethers.JsonRpcProvider(url);
  }
  return provider;
}

function getContract(name) {
  if (contractCache.has(name)) return contractCache.get(name);

  const envKey = CONTRACT_ADDRESS_ENV[name];
  if (!envKey) {
    throw new Error(`Unknown contract '${name}'`);
  }

  const address = process.env[envKey];
  if (!address) {
    throw new Error(
      `${envKey} is not set; cannot perform on-chain checks against ${name}`
    );
  }

  const contract = new ethers.Contract(address, ACCESS_CONTROL_ABI, getProvider());
  contractCache.set(name, contract);
  return contract;
}

/**
 * Resolves a role name to its bytes32 id.
 *
 * The value is keccak256 of the role name for every role except
 * DEFAULT_ADMIN_ROLE, which is zero. Computing it locally avoids a round trip,
 * and matches how OpenZeppelin's AccessControl defines them.
 */
function roleId(roleName) {
  if (roleName === 'DEFAULT_ADMIN_ROLE') return ethers.ZeroHash;
  return ethers.id(roleName);
}

async function hasRole(contractName, roleName, account) {
  if (!ethers.isAddress(account)) {
    throw new Error(`'${account}' is not a valid address`);
  }

  const contract = getContract(contractName);
  return contract.hasRole(roleId(roleName), account);
}

async function isReachable() {
  try {
    await getProvider().getBlockNumber();
    return true;
  } catch (error) {
    logger.warn(`Chain RPC unreachable: ${error.message}`);
    return false;
  }
}

/** Test seam: drops cached provider/contracts. */
function reset() {
  provider = undefined;
  contractCache.clear();
}

module.exports = {
  hasRole,
  roleId,
  getContract,
  getProvider,
  isReachable,
  reset,
  CONTRACT_ADDRESS_ENV,
};
