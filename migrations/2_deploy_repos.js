var GovernmentOfficerRepo = artifacts.require("./GovernmentOfficerRepo.sol");
var TenderRepo = artifacts.require("./TenderRepo.sol");
var ContractRepo = artifacts.require("./ContractRepo.sol");
var ContractorRepo = artifacts.require("./ContractorRepo.sol");
var Contract = artifacts.require("./Contract.sol");
var Contractor = artifacts.require("./Contractor.sol");
var GovernmentOfficer = artifacts.require("./GovernmentOfficer.sol");
var Tender = artifacts.require("./Tender.sol");
var Verifier = artifacts.require("./Verifier.sol");

module.exports = async function (deployer, network, accounts) {
  // The registries are access controlled. accounts[0] becomes DEFAULT_ADMIN_ROLE
  // and is responsible for granting the operational roles - see
  // 5_configure_roles.js.
  const admin = accounts[0];

  await deployer.deploy(GovernmentOfficerRepo, admin);
  await deployer.deploy(TenderRepo, admin);
  await deployer.deploy(ContractRepo, admin);
  await deployer.deploy(ContractorRepo, admin);

  await deployer.deploy(Contract);
  await deployer.deploy(Contractor);
  await deployer.deploy(GovernmentOfficer);
  await deployer.deploy(Tender);
  await deployer.deploy(Verifier);

  console.log("\n=== Repositories Deployed (admin: " + admin + ") ===");
};
