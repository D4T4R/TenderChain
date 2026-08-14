const GovernmentOfficerRepo = artifacts.require("./GovernmentOfficerRepo.sol");
const TenderRepo = artifacts.require("./TenderRepo.sol");
const ContractRepo = artifacts.require("./ContractRepo.sol");
const ContractorRepo = artifacts.require("./ContractorRepo.sol");
const StakeManager = artifacts.require("./StakeManager.sol");
const PublicClaims = artifacts.require("./PublicClaims.sol");
const FactoryContractor = artifacts.require("./FactoryContractor.sol");
const FactoryGovernmentOfficer = artifacts.require("./FactoryGovernmentOfficer.sol");
const FactoryContract = artifacts.require("./FactoryContract.sol");
const FactoryTender = artifacts.require("./FactoryTender.sol");

/**
 * Wires up the access control roles introduced with TenderRoles.
 *
 * Roles are granted to the factory contracts (which create registry entries)
 * and, for local development, to the deploying account so that the existing
 * web3 flows keep working. On a real deployment the admin should grant
 * VERIFIER_ROLE and STATUS_UPDATER_ROLE per-address instead of holding them.
 */
module.exports = async function (deployer, network, accounts) {
  const admin = accounts[0];

  const officerRepo = await GovernmentOfficerRepo.deployed();
  const tenderRepo = await TenderRepo.deployed();
  const contractRepo = await ContractRepo.deployed();
  const contractorRepo = await ContractorRepo.deployed();
  const stakeManager = await StakeManager.deployed();
  const publicClaims = await PublicClaims.deployed();

  const factoryContractor = await FactoryContractor.deployed();
  const factoryOfficer = await FactoryGovernmentOfficer.deployed();
  const factoryContract = await FactoryContract.deployed();
  const factoryTender = await FactoryTender.deployed();

  const REGISTRAR_ROLE = await tenderRepo.REGISTRAR_ROLE();
  const VERIFIER_ROLE = await tenderRepo.VERIFIER_ROLE();
  const STATUS_UPDATER_ROLE = await tenderRepo.STATUS_UPDATER_ROLE();
  const SLASHER_ROLE = await stakeManager.SLASHER_ROLE();

  const grants = [
    // Registries write access: the matching factory, plus the admin for the
    // current EOA-driven web3 flows.
    [tenderRepo, REGISTRAR_ROLE, factoryTender.address, "TenderRepo/REGISTRAR -> FactoryTender"],
    [tenderRepo, REGISTRAR_ROLE, admin, "TenderRepo/REGISTRAR -> admin"],
    [tenderRepo, STATUS_UPDATER_ROLE, admin, "TenderRepo/STATUS_UPDATER -> admin"],

    [contractRepo, REGISTRAR_ROLE, factoryContract.address, "ContractRepo/REGISTRAR -> FactoryContract"],
    [contractRepo, REGISTRAR_ROLE, admin, "ContractRepo/REGISTRAR -> admin"],
    [contractRepo, STATUS_UPDATER_ROLE, admin, "ContractRepo/STATUS_UPDATER -> admin"],

    [contractorRepo, REGISTRAR_ROLE, factoryContractor.address, "ContractorRepo/REGISTRAR -> FactoryContractor"],
    [contractorRepo, REGISTRAR_ROLE, admin, "ContractorRepo/REGISTRAR -> admin"],
    [contractorRepo, VERIFIER_ROLE, admin, "ContractorRepo/VERIFIER -> admin"],

    [officerRepo, REGISTRAR_ROLE, factoryOfficer.address, "OfficerRepo/REGISTRAR -> FactoryGovernmentOfficer"],
    [officerRepo, REGISTRAR_ROLE, admin, "OfficerRepo/REGISTRAR -> admin"],
    [officerRepo, VERIFIER_ROLE, admin, "OfficerRepo/VERIFIER -> admin"],

    // Only the adjudicating contract may slash stakes. Deliberately NOT the admin.
    [stakeManager, SLASHER_ROLE, publicClaims.address, "StakeManager/SLASHER -> PublicClaims"],
  ];

  for (const [contract, role, account, label] of grants) {
    await contract.grantRole(role, account);
    console.log("  granted", label);
  }

  console.log("\n=== Access control roles configured ===");
  console.log("Admin (DEFAULT_ADMIN_ROLE):", admin);
  console.log("SLASHER_ROLE is held only by PublicClaims:", publicClaims.address);
  console.log("=======================================");
};
