/**
 * Deployed contract addresses, supplied via environment so that a redeploy does
 * not require a code change. See .env.local.example.
 *
 * Truffle writes deployed addresses into build/contracts/*.json under
 * "networks", but those are per-network-id and get wiped by `migrate --reset`,
 * so the frontend reads them from env instead.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    // Deliberately not throwing at module load: that would break the whole app
    // when a single address is missing. Surfaced at call time instead.
    return "";
  }
  return value;
}

export const CONTRACT_ADDRESSES = {
  TenderRepo: required(
    "NEXT_PUBLIC_TENDER_REPO_ADDRESS",
    process.env.NEXT_PUBLIC_TENDER_REPO_ADDRESS
  ),
  ContractRepo: required(
    "NEXT_PUBLIC_CONTRACT_REPO_ADDRESS",
    process.env.NEXT_PUBLIC_CONTRACT_REPO_ADDRESS
  ),
  ContractorRepo: required(
    "NEXT_PUBLIC_CONTRACTOR_REPO_ADDRESS",
    process.env.NEXT_PUBLIC_CONTRACTOR_REPO_ADDRESS
  ),
  GovernmentOfficerRepo: required(
    "NEXT_PUBLIC_GOVERNMENT_OFFICER_REPO_ADDRESS",
    process.env.NEXT_PUBLIC_GOVERNMENT_OFFICER_REPO_ADDRESS
  ),
  FactoryTender: required(
    "NEXT_PUBLIC_FACTORY_TENDER_ADDRESS",
    process.env.NEXT_PUBLIC_FACTORY_TENDER_ADDRESS
  ),
  FactoryContractor: required(
    "NEXT_PUBLIC_FACTORY_CONTRACTOR_ADDRESS",
    process.env.NEXT_PUBLIC_FACTORY_CONTRACTOR_ADDRESS
  ),
  FactoryGovernmentOfficer: required(
    "NEXT_PUBLIC_FACTORY_GOVERNMENT_OFFICER_ADDRESS",
    process.env.NEXT_PUBLIC_FACTORY_GOVERNMENT_OFFICER_ADDRESS
  ),
  FactoryVerifier: required(
    "NEXT_PUBLIC_FACTORY_VERIFIER_ADDRESS",
    process.env.NEXT_PUBLIC_FACTORY_VERIFIER_ADDRESS
  ),
  StakeManager: required(
    "NEXT_PUBLIC_STAKE_MANAGER_ADDRESS",
    process.env.NEXT_PUBLIC_STAKE_MANAGER_ADDRESS
  ),
  PublicClaims: required(
    "NEXT_PUBLIC_PUBLIC_CLAIMS_ADDRESS",
    process.env.NEXT_PUBLIC_PUBLIC_CLAIMS_ADDRESS
  ),
  PublicDashboard: required(
    "NEXT_PUBLIC_PUBLIC_DASHBOARD_ADDRESS",
    process.env.NEXT_PUBLIC_PUBLIC_DASHBOARD_ADDRESS
  ),
} as const;

export type DeployedContract = keyof typeof CONTRACT_ADDRESSES;

export function getAddress(name: DeployedContract): string {
  const address = CONTRACT_ADDRESSES[name];
  if (!address) {
    throw new Error(
      `No address configured for ${name}. Set the corresponding NEXT_PUBLIC_* variable in frontend-next/.env.local (see .env.local.example).`
    );
  }
  return address;
}

export const EXPECTED_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? "1337"
);
