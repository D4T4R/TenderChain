// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./StakeManager.sol";

contract Tender {   
    address public governmentOfficerAddress;
    string public tenderName; 
    string public tenderId;
    uint256 public bidSubmissionClosingDate;
    uint256 public bidOpeningDate;
    uint256 public keySubmissionDeadline; // New: deadline for key submission
    uint256 public covers;
    string[] public clauses;
    string[] public taskName;
    uint256[] public taskDays;
    string[] public constraints;
    uint256 finalTenderAmount;
    string public tenderCategory; // e.g., "Roads", "Bridges", "Buildings"
    uint256 public minimumEMD; // Minimum Earnest Money Deposit required
    
    // Bid encryption/decryption system
    bool public biddingClosed;
    bool public keysSubmitted;
    bool public bidsDecrypted;
    
    StakeManager public stakeManager;

    struct ContractorProposal {
        address contractorAddress;
        string encryptedBid; // Encrypted bid data
        string bidKey; // Decryption key (submitted after bidding period)
        bool keySubmitted;
        string[] quotationClause; // Decrypted data
        uint256[] quotationAmount; // Decrypted data
        uint256 proposalAmount; // Decrypted data
        string[] constraintDocuments;
        ProposalStatus status;
        uint256 emdAmount; // EMD deposited by this bidder
        uint256 emdStakeId; // Stake ID for EMD
        bool emdRefunded;
    }

    enum ProposalStatus {
        verified,
        unverified,
        rejected
    }

    ContractorProposal[] public allContractorProposals;
    mapping (address => ProposalStatus) isProposalVerified;

    function getTenderName() public view returns (string memory) {
        return tenderName;
    }

    function setTenderBasic(
        address _governmentOfficerAddress, 
        string memory _tenderName, 
        string memory _tenderId, 
        uint256 _bidSubmissionClosingDate, 
        uint256 _bidOpeningDate, 
        uint256 _covers,
        string memory _tenderCategory,
        uint256 _minimumEMD,
        address _stakeManagerAddress
    ) public {
        governmentOfficerAddress = _governmentOfficerAddress;   
        tenderName = _tenderName;
        tenderId = _tenderId;
        bidSubmissionClosingDate = _bidSubmissionClosingDate;
        bidOpeningDate = _bidOpeningDate;
        covers = _covers;
        tenderCategory = _tenderCategory;
        minimumEMD = _minimumEMD;
        finalTenderAmount = 0;
        
        // Key submission deadline is 24 hours after bid closing
        keySubmissionDeadline = _bidSubmissionClosingDate + 86400; // 24 hours
        
        biddingClosed = false;
        keysSubmitted = false;
        bidsDecrypted = false;
        
        stakeManager = StakeManager(_stakeManagerAddress);
    }
    
    function setTenderAdvanced(string[] memory  _clauses,
    string[] memory _taskName, uint256[] memory  _taskDays,
    string[] memory _constraints) public {
        clauses = _clauses;
        taskName = _taskName;
        taskDays = _taskDays;
        constraints = _constraints;
    }

    function getTenderBasic() public view returns (address, string memory, string memory,
    uint, uint, uint) {
        return (governmentOfficerAddress, tenderName, tenderId, 
        bidSubmissionClosingDate, bidOpeningDate, covers);
    }

    function getTenderAdvanced() public view returns (string[] memory, string[] memory, uint256[] memory, string[] memory) {
        return (clauses, taskName, taskDays, constraints );
    }

    function submitEncryptedBid(
        address _contractorAddress,
        string memory _encryptedBid,
        string[] memory _constraintDocuments
    ) public payable returns (bool) {
        require(block.timestamp <= bidSubmissionClosingDate, "Bidding period closed");
        require(!biddingClosed, "Bidding is closed");
        require(msg.value >= minimumEMD, "Insufficient EMD");
        
        // Create stake for EMD
        uint256 emdStakeId = stakeManager.createStake{value: msg.value}(
            StakeManager.StakeType.CONTRACTOR_EMD,
            address(this)
        );
        
        allContractorProposals.push();
        ContractorProposal storage temp = allContractorProposals[allContractorProposals.length - 1];
        temp.contractorAddress = _contractorAddress;
        temp.encryptedBid = _encryptedBid;
        temp.keySubmitted = false;
        temp.emdAmount = msg.value;
        temp.emdStakeId = emdStakeId;
        temp.emdRefunded = false;
        
        for (uint j=0; j < _constraintDocuments.length; j++) {
            temp.constraintDocuments.push(_constraintDocuments[j]);
        }
        
        temp.status = ProposalStatus.unverified;
        return true;
    }
    
    function submitBidKey(string memory _bidKey) public returns (bool) {
        require(block.timestamp > bidSubmissionClosingDate, "Bidding period not yet closed");
        require(block.timestamp <= keySubmissionDeadline, "Key submission deadline passed");
        
        // Find the bidder's proposal
        for (uint i = 0; i < allContractorProposals.length; i++) {
            if (allContractorProposals[i].contractorAddress == msg.sender) {
                allContractorProposals[i].bidKey = _bidKey;
                allContractorProposals[i].keySubmitted = true;
                return true;
            }
        }
        
        revert("No bid found for this address");
    }

    function getBiddingCloseDate() public view returns (uint256) {
        return bidSubmissionClosingDate;
    }
    
    function getKeySubmissionDeadline() public view returns (uint256) {
        return keySubmissionDeadline;
    }
    
    function getTenderCategory() public view returns (string memory) {
        return tenderCategory;
    }
    
    function getMinimumEMD() public view returns (uint256) {
        return minimumEMD;
    }

    function getProposalCount() public view returns (uint256) {
        return allContractorProposals.length;
    }

    function setTenderAmount(uint256 amount) public {
        if (amount != 0 && finalTenderAmount == 0)
            finalTenderAmount = amount;
    }

    function getProposalsToVerify(uint index) public view returns (string[] memory, string[][] memory, address) {
        require(index < allContractorProposals.length, "Index out of bounds");
        require(allContractorProposals[index].status == ProposalStatus.unverified, "Not unverified");
        // Build a memory copy of constraintDocuments as string[][] of length 1
        string[] storage srcDocs = allContractorProposals[index].constraintDocuments;
        string[][] memory docs = new string[][](1);
        string[] memory inner = new string[](srcDocs.length);
        for (uint i = 0; i < srcDocs.length; i++) {
            inner[i] = srcDocs[i];
        }
        docs[0] = inner;
        address addr = allContractorProposals[index].contractorAddress;
        return (constraints, docs, addr);
    }

    function decryptBid(
        uint256 _bidIndex,
        string[] memory _quotationClause,
        uint256[] memory _quotationAmount
    ) public {
        require(_bidIndex < allContractorProposals.length, "Invalid bid index");
        require(msg.sender == governmentOfficerAddress, "Only government officer can decrypt");
        require(allContractorProposals[_bidIndex].keySubmitted, "Key not submitted");
        require(_quotationClause.length == _quotationAmount.length, "Mismatched arrays");
        
        ContractorProposal storage proposal = allContractorProposals[_bidIndex];
        
        // Clear existing data
        delete proposal.quotationClause;
        delete proposal.quotationAmount;
        
        uint256 total = 0;
        for (uint i = 0; i < _quotationClause.length; i++) {
            proposal.quotationClause.push(_quotationClause[i]);
            proposal.quotationAmount.push(_quotationAmount[i]);
            total += _quotationAmount[i];
        }
        
        proposal.proposalAmount = total;
        proposal.status = ProposalStatus.unverified;
    }
    
    function verifyProposal(address contractorAddress) public {
        require(msg.sender == governmentOfficerAddress, "Only government officer can verify");
        isProposalVerified[contractorAddress] = ProposalStatus.verified;
    }

    function rejectProposal(address contractorAddress) public {
        require(msg.sender == governmentOfficerAddress, "Only government officer can reject");
        isProposalVerified[contractorAddress] = ProposalStatus.rejected;
        
        // Refund EMD for rejected proposals
        for (uint i = 0; i < allContractorProposals.length; i++) {
            if (allContractorProposals[i].contractorAddress == contractorAddress && !allContractorProposals[i].emdRefunded) {
                stakeManager.releaseStake(allContractorProposals[i].emdStakeId);
                allContractorProposals[i].emdRefunded = true;
                break;
            }
        }
    }

    function getProposal(uint256 index) public view returns (
        address, uint256, string[] memory, uint256[] memory, ProposalStatus, bool, uint256
    ) {
        require(index < allContractorProposals.length, "Index out of bounds");
        return (
            allContractorProposals[index].contractorAddress, 
            allContractorProposals[index].proposalAmount, 
            allContractorProposals[index].quotationClause,
            allContractorProposals[index].quotationAmount, 
            allContractorProposals[index].status,
            allContractorProposals[index].keySubmitted,
            allContractorProposals[index].emdAmount
        );
    }
    
    function getEncryptedBid(uint256 index) public view returns (string memory, bool) {
        require(index < allContractorProposals.length, "Index out of bounds");
        require(msg.sender == governmentOfficerAddress || msg.sender == allContractorProposals[index].contractorAddress, "Unauthorized");
        return (allContractorProposals[index].encryptedBid, allContractorProposals[index].keySubmitted);
    }
    
    function getBidKey(uint256 index) public view returns (string memory) {
        require(index < allContractorProposals.length, "Index out of bounds");
        require(msg.sender == governmentOfficerAddress, "Only government officer can view keys");
        require(allContractorProposals[index].keySubmitted, "Key not submitted");
        return allContractorProposals[index].bidKey;
    }

    function getVerifiedProposals(uint index) public view returns (string[] memory, string[][] memory, address, uint[] memory) {
        require(index < allContractorProposals.length, "Index out of bounds");
        require(allContractorProposals[index].status == ProposalStatus.verified, "Not verified");
        string[] storage srcDocs = allContractorProposals[index].constraintDocuments;
        string[][] memory docs = new string[][](1);
        string[] memory inner = new string[](srcDocs.length);
        for (uint i = 0; i < srcDocs.length; i++) {
            inner[i] = srcDocs[i];
        }
        docs[0] = inner;
        address addr = allContractorProposals[index].contractorAddress;
        uint256[] storage srcAmts = allContractorProposals[index].quotationAmount;
        uint[] memory amts = new uint[](srcAmts.length);
        for (uint j = 0; j < srcAmts.length; j++) {
            amts[j] = srcAmts[j];
        }
        return (constraints, docs, addr, amts);
    }
    
}
