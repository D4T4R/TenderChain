// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./StakeManager.sol";

contract Verifier {

    address walletAddress;
    string email;
    string phoneNumber;
    string name;
    string employeeId;
    address[] documentsVerified;
    address[] officersVerified;
    address[] contractorsVerified;
    
    // Enhanced verifier profile
    string[] public expertiseDomains; // e.g., ["Civil Engineering", "Road Construction"]
    uint256 public reputationScore; // 0-1000, starts at 500
    bool public isRegistered;
    bool public isActive;
    uint256 public registrationStakeId;
    
    // Verification tracking
    address[] public assignedContracts;
    mapping(address => bool) public isAssignedToContract;
    mapping(address => uint256[]) public verificationHistory; // contract => task indices verified
    
    StakeManager public stakeManager;
    
    // Verification statistics
    uint256 public totalVerifications;
    uint256 public correctVerifications;
    uint256 public slashedVerifications;
    
    function setVerifier(
        address _walletAddress, 
        string memory _email, 
        string memory _phoneNumber, 
        string memory _name, 
        string memory _employeeId,
        string[] memory _expertiseDomains,
        address _stakeManagerAddress
    ) public payable returns (bool) {
        require(!isRegistered, "Verifier already registered");
        require(msg.value >= 1 ether, "Insufficient registration stake");
        
        walletAddress = _walletAddress;
        email = _email;
        phoneNumber = _phoneNumber;
        name = _name;
        employeeId = _employeeId;
        expertiseDomains = _expertiseDomains;
        reputationScore = 500; // Start with neutral reputation
        isRegistered = true;
        isActive = true;
        
        stakeManager = StakeManager(_stakeManagerAddress);
        
        // Create registration stake
        registrationStakeId = stakeManager.createStake{value: msg.value}(
            StakeManager.StakeType.VERIFIER_REGISTRATION, 
            address(this)
        );
        
        return true;
    }

    // function login(address userAddress, string role) public  returns (string) {
    // }

    // //unverified
    // function getAllUnverifiedGovernmentOfficers(string token) public returns (address[]) {
    //     //defined in GovernmentOfficerRepo
    // }    

    // function getAllUnverifiedContractors(string token) public returns (address[]) {
    //     //defined in ContractorRepo
    // }   

    // function getAllUnverifiedDocuments(string token) public returns (string[]) {
    //     //getProposalToVerify() in Tender.sol
    // }


    // verification
    function verifyGovernmentOfficer(address govtOfficer) public returns (bool) {
        require(isActive, "Verifier not active");
        officersVerified.push(govtOfficer);
        return true;
    }

    function verifyContractor(address contractor) public returns (bool) {
        require(isActive, "Verifier not active");
        contractorsVerified.push(contractor);
        return true;
    }

    function verifyProposalDocuments(address tender) public returns (bool) {
        require(isActive, "Verifier not active");
        documentsVerified.push(tender);
        return true;
    }
    
    function assignToContract(address _contractAddress) public returns (bool) {
        require(isActive, "Verifier not active");
        require(!isAssignedToContract[_contractAddress], "Already assigned to this contract");
        
        assignedContracts.push(_contractAddress);
        isAssignedToContract[_contractAddress] = true;
        return true;
    }
    
    function unassignFromContract(address _contractAddress) public returns (bool) {
        require(isAssignedToContract[_contractAddress], "Not assigned to this contract");
        
        isAssignedToContract[_contractAddress] = false;
        
        // Remove from array
        for (uint i = 0; i < assignedContracts.length; i++) {
            if (assignedContracts[i] == _contractAddress) {
                assignedContracts[i] = assignedContracts[assignedContracts.length - 1];
                assignedContracts.pop();
                break;
            }
        }
        
        return true;
    }

    function recordVerification(address _contractAddress, uint256 _taskIndex, bool _wasCorrect) public {
        // This should be called by contract logic to update verifier stats
        require(isAssignedToContract[_contractAddress], "Not assigned to this contract");
        
        verificationHistory[_contractAddress].push(_taskIndex);
        totalVerifications++;
        
        if (_wasCorrect) {
            correctVerifications++;
            // Increase reputation for correct verification
            if (reputationScore < 1000) {
                reputationScore += 10;
            }
        } else {
            slashedVerifications++;
            // Decrease reputation for incorrect verification
            if (reputationScore > 50) {
                reputationScore -= 50;
            }
            
            // Deactivate verifier if reputation too low
            if (reputationScore < 100) {
                isActive = false;
            }
        }
    }
    
    function getVerifierProfile() public view returns (
        string memory, // name
        string[] memory, // expertise domains
        uint256, // reputation score
        bool, // is active
        uint256, // total verifications
        uint256, // correct verifications
        uint256 // slashed verifications
    ) {
        return (name, expertiseDomains, reputationScore, isActive, totalVerifications, correctVerifications, slashedVerifications);
    }
    
    function getAssignedContracts() public view returns (address[] memory) {
        return assignedContracts;
    }
    
    function getVerificationHistory(address _contractAddress) public view returns (uint256[] memory) {
        return verificationHistory[_contractAddress];
    }
    
    function getExpertiseDomains() public view returns (string[] memory) {
        return expertiseDomains;
    }
    
    function myVerifiedDocuments() public view returns (address[] memory ) {
        return documentsVerified;
    }

    function myVerifiedOfficers() public view returns (address[] memory) {
        return officersVerified;
    }

    function myVerifiedContractors() public view returns (address[] memory ) {
        return contractorsVerified;
    }
    
    function deactivateVerifier() public {
        require(msg.sender == walletAddress, "Only verifier can deactivate");
        isActive = false;
    }
    
    function reactivateVerifier() public payable {
        require(msg.sender == walletAddress, "Only verifier can reactivate");
        require(!isActive, "Verifier already active");
        require(msg.value >= 0.5 ether, "Insufficient reactivation stake");
        
        // Create additional stake for reactivation
        stakeManager.createStake{value: msg.value}(
            StakeManager.StakeType.VERIFIER_REGISTRATION, 
            address(this)
        );
        
        isActive = true;
        reputationScore = 500; // Reset to neutral reputation
    }

    function logout() public returns(bool) {
        // Implementation for logout if needed
        return true;
    }
}