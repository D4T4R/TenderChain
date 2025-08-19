// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./StakeManager.sol";

contract Contractor {

    address walletAddress;
    string  name;
    string  email;
    string  phoneNumber;
    string  panNumber;
    string  gstNumber;
    bool isVerified;
    
    // KYC and approval related fields
    string[] public workCategories; // e.g., ["Roads", "Bridges", "Buildings"]
    uint256 public netWorth; // contractor's financial capacity
    string[] public previousProjects; // names of completed projects
    uint256[] public previousProjectValues; // values of completed projects
    address public departmentOfficer; // Officer 2 who approves this contractor
    bool public kycApproved;
    string public kycRejectionReason;
    
    // EMD (Earnest Money Deposit) tracking
    mapping(address => uint256) public tenderEMDs; // tender address => EMD amount
    StakeManager public stakeManager;

    address[] placedBids;
    mapping (address=>bool) public bidStatus; //false =>rejected or not seen,true => accepted
    
    address[] contracts;
    mapping (address=>bool) public contractStatus; //true=> active,false=>completed
    
    function setContractor(
        address _walletAddress, 
        string memory _email, 
        string memory _name,
        string memory _phoneNumber, 
        string memory _panNumber, 
        string memory _gstNumber, 
        string[] memory _workCategories,
        uint256 _netWorth,
        string[] memory _previousProjects,
        uint256[] memory _previousProjectValues,
        address _stakeManagerAddress
    ) public {
        require(_previousProjects.length == _previousProjectValues.length, "Project arrays must be same length");
        walletAddress = _walletAddress;
        name = _name;
        email = _email;
        phoneNumber = _phoneNumber;
        panNumber = _panNumber;
        gstNumber = _gstNumber;
        workCategories = _workCategories;
        netWorth = _netWorth;
        previousProjects = _previousProjects;
        previousProjectValues = _previousProjectValues;
        isVerified = false;
        kycApproved = false;
        stakeManager = StakeManager(_stakeManagerAddress);
    }

    function updateOfficerVerifiedStatus() public {
        isVerified = true;
    }
    
    function approveKYC(address _departmentOfficer) public {
        // Only the department officer can approve
        departmentOfficer = _departmentOfficer;
        kycApproved = true;
    }
    
    function rejectKYC(string memory _reason, address _departmentOfficer) public {
        departmentOfficer = _departmentOfficer;
        kycRejectionReason = _reason;
        kycApproved = false;
    }
    
    function getKYCStatus() public view returns (bool, string memory, address) {
        return (kycApproved, kycRejectionReason, departmentOfficer);
    }
    
    function getContractorProfile() public view returns (
        string memory, // name
        string[] memory, // work categories
        uint256, // net worth
        string[] memory, // previous projects
        uint256[] memory, // previous project values
        bool // kyc approved
    ) {
        return (name, workCategories, netWorth, previousProjects, previousProjectValues, kycApproved);
    }

    function getContracts() public view returns (address[] memory) {
        return contracts;
    }

    function addToContracts(address contractAddress) public returns (bool) {
        contracts.push(contractAddress);
        contractStatus[contractAddress] = true;
        return true;
    }

    function getContractStatus(address contractAddress) public view returns (bool) {
        return contractStatus[contractAddress];
    }

    function changeContractStatus(address contractAddress) public {
        contractStatus[contractAddress] = false;
    }

    function depositEMD(address tenderAddress) public payable returns (uint256) {
        // Deposit EMD (Earnest Money Deposit) required to place a bid
        require(msg.value > 0, "EMD amount must be greater than 0");
        uint256 stakeId = stakeManager.createStake{value: msg.value}(StakeManager.StakeType.CONTRACTOR_EMD, tenderAddress);
        tenderEMDs[tenderAddress] = msg.value;
        return stakeId;
    }
    
    function placeBid(address tenderAddress) public returns (bool) {
        // Ensure contractor has deposited EMD and is KYC approved
        require(tenderEMDs[tenderAddress] > 0, "Must deposit EMD before bidding");
        require(kycApproved, "KYC must be approved to place bid");
        
        placedBids.push(tenderAddress);
        bidStatus[tenderAddress] = false;
        return true;
    }

    function getPlacedBids() public view returns (address[] memory) {
        //loop for Accepted Bids
        return placedBids;
    }

    function getBidStatus(address tenderAddress) public view returns (bool){
        return bidStatus[tenderAddress];
    }

    function updateBidStatus(address tenderAddress) public {
        bidStatus[tenderAddress] = true;
    }
    
    function getWorkCategories() public view returns (string[] memory) {
        return workCategories;
    }
    
    function getPreviousTrackRecord() public view returns (string[] memory, uint256[] memory) {
        return (previousProjects, previousProjectValues);
    }
    
    function getNetWorth() public view returns (uint256) {
        return netWorth;
    }
    
    function refundEMD(address tenderAddress, uint256 stakeId) public returns (bool) {
        // Refund EMD for rejected bids
        require(bidStatus[tenderAddress] == false, "Cannot refund EMD for accepted bids");
        require(stakeManager.releaseStake(stakeId), "Failed to release EMD stake");
        tenderEMDs[tenderAddress] = 0;
        return true;
    }
}