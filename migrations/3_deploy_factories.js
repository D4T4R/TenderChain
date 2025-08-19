var FactoryContractor = artifacts.require("./FactoryContractor.sol");
var FactoryGovernmentOfficer = artifacts.require("./FactoryGovernmentOfficer.sol");
var FactoryContract = artifacts.require("./FactoryContract.sol");
var FactoryTender = artifacts.require("./FactoryTender.sol");

module.exports = async function(deployer) {
  // Deploy factory contracts first
  await deployer.deploy(FactoryContractor);
  const factoryContractor = await FactoryContractor.deployed();
  
  await deployer.deploy(FactoryGovernmentOfficer);
  const factoryGovernmentOfficer = await FactoryGovernmentOfficer.deployed();
  
  await deployer.deploy(FactoryContract);
  const factoryContract = await FactoryContract.deployed();
  
  await deployer.deploy(FactoryTender);
  const factoryTender = await FactoryTender.deployed();
  
  console.log("\n=== Factory Contracts Deployed ===");
  console.log("FactoryContractor:", factoryContractor.address);
  console.log("FactoryGovernmentOfficer:", factoryGovernmentOfficer.address);
  console.log("FactoryContract:", factoryContract.address);
  console.log("FactoryTender:", factoryTender.address);
  console.log("===================================");
};
