var StakeManager = artifacts.require("./StakeManager.sol");
var PublicClaims = artifacts.require("./PublicClaims.sol");
var PublicDashboard = artifacts.require("./PublicDashboard.sol");
var FactoryVerifier = artifacts.require("./FactoryVerifier.sol");

module.exports = async function(deployer) {
  // Deploy StakeManager first as other contracts depend on it
  await deployer.deploy(StakeManager);
  const stakeManager = await StakeManager.deployed();
  
  console.log("StakeManager deployed at:", stakeManager.address);
  
  // Deploy PublicClaims with StakeManager address
  await deployer.deploy(PublicClaims, stakeManager.address);
  const publicClaims = await PublicClaims.deployed();
  
  console.log("PublicClaims deployed at:", publicClaims.address);
  
  // Deploy PublicDashboard with PublicClaims address
  await deployer.deploy(PublicDashboard, publicClaims.address);
  const publicDashboard = await PublicDashboard.deployed();
  
  console.log("PublicDashboard deployed at:", publicDashboard.address);
  
  // Deploy FactoryVerifier
  await deployer.deploy(FactoryVerifier);
  const factoryVerifier = await FactoryVerifier.deployed();
  
  console.log("FactoryVerifier deployed at:", factoryVerifier.address);
  
  console.log("\n=== Enhanced TenderChain System Deployed Successfully ===");
  console.log("Contract Addresses:");
  console.log("StakeManager:", stakeManager.address);
  console.log("PublicClaims:", publicClaims.address);
  console.log("PublicDashboard:", publicDashboard.address);
  console.log("FactoryVerifier:", factoryVerifier.address);
  console.log("=====================================================");
};
