// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./StakeManager.sol";

contract Contract {   
    address public governmentOfficerAddress;
    address public contractorAddress;
    string tenderId;
    uint public creationDate;
    uint public completionDate;
    string[] public constraints;
    uint finalQuotationAmount;

    bool public governmentOfficerVerified;
    string public contractName;
    
    // Milestone verification system
    address[] public assignedVerifiers;
    mapping(address => bool) public isAssignedVerifier;
    StakeManager public stakeManager;

    mapping (uint=>Task) private taskIndexMapping;
    mapping (uint=>MilestoneVerification[]) public milestoneVerifications;
    
    struct Task {
        string description;
        uint deadlineTime;
        uint amount; 
        TaskStatus status;
        uint completionTime;
        string ipfsProofHash; // IPFS hash containing photos, geolocation, etc.
        uint verificationCount;
        uint requiredVerifications; // minimum verifications needed
    }
    
    struct MilestoneVerification {
        address verifier;
        bool isApproved;
        string comments;
        uint timestamp;
        uint256 stakeId; // stake put by verifier
        string ipfsProofHash; // verifier's own proof if any
    }

    enum TaskStatus {
        pending,
        reportedComplete,
        underVerification,
        verificationRejected,
        partiallyVerified,
        complete,
        contractorPaid
    }

    Task[] public tasks;

    modifier onlyGovernmentOfficer {
        require(msg.sender == governmentOfficerAddress, "WRONG GOVERNEMT OFFICER!");
        _;
    }

    modifier onlyContractor {
        require(msg.sender == contractorAddress, "WRONG CONTACTOR");
        _;
    }

    // modifier onlySpecialOfficer {
    //     if (msg.sender != specialOfficerAddress) {
    //         revert();
    //         _;
    //     }
    // }
    
    function setContractBasic (
        address _governmentOfficerAddress, 
        address _contractorAddress, 
        string memory _tenderId,
        uint _completionDate,
        string[] memory _constraints,
        address[] memory _assignedVerifiers,
        address _stakeManagerAddress
        ) public {
        governmentOfficerAddress = _governmentOfficerAddress;
        contractorAddress = _contractorAddress;
        tenderId = _tenderId;
        constraints = _constraints;
        creationDate = block.timestamp;
        completionDate = _completionDate;
        
        // Set assigned verifiers
        assignedVerifiers = _assignedVerifiers;
        for (uint i = 0; i < _assignedVerifiers.length; i++) {
            isAssignedVerifier[_assignedVerifiers[i]] = true;
        }
        
        stakeManager = StakeManager(_stakeManagerAddress);
    }


// string description;
//         uint deadlineTime;
//         uint amount; 
//         TaskStatus status;
//         uint completionTime; 
    function setContractAdvanced (
        string memory  _contractName, 
        uint _finalQuotationAmount,
        string[] memory  _taskDescription, 
        uint[] memory  _deadlineForEachTask, 
        uint[] memory  _amountForEachTask) public {
        contractName = _contractName;
        finalQuotationAmount = _finalQuotationAmount;
        uint totalAmount = 0;
        
        for (uint i=0; i < _taskDescription.length; i++) {
            Task memory task =  Task({
                description: _taskDescription[i], 
                deadlineTime: _deadlineForEachTask[i], 
                amount: _amountForEachTask[i], 
                status: TaskStatus.pending, 
                completionTime: block.timestamp + _deadlineForEachTask[i],
                ipfsProofHash: "",
                verificationCount: 0,
                requiredVerifications: 2 // Default: need 2 verifications (1 third-party + 1 government)
            });
            totalAmount += _amountForEachTask[i];
            
            taskIndexMapping[i] = task;
            tasks.push(task);
        }
        require(totalAmount >= _finalQuotationAmount, "Final Quation Amount EXCEEDS!");
        //ContractDeployed();
    }

    function getContractBasic() public view returns (string memory , address, address, string memory,
    uint, uint) {
        return (contractName, governmentOfficerAddress, contractorAddress, tenderId,
        creationDate, completionDate);
    }

    function getContractAdvanced() public view returns (string memory, uint, string[] memory) {
        return (contractName, finalQuotationAmount, 
        constraints);
    }

    function getContractName() public view returns (string memory) {
        return contractName;
    }

    function getCompletionDate() public view returns (uint) {
        return completionDate;
    }

    function getNumberOfTasks() public view returns (uint) {
        return tasks.length;
    }

    function getTask(uint256 index) public view returns (
        string memory, uint, uint, TaskStatus, uint, string memory, uint, uint
    ) {
        return (
            tasks[index].description, 
            tasks[index].deadlineTime, 
            tasks[index].amount,
            tasks[index].status, 
            tasks[index].completionTime,
            tasks[index].ipfsProofHash,
            tasks[index].verificationCount,
            tasks[index].requiredVerifications
        );
    }

    function taskCompletedByContractor(uint _taskIndex, string memory _ipfsProofHash) public onlyContractor {
        if (_taskIndex >= tasks.length) revert();
        Task storage task = tasks[_taskIndex];

        if (msg.sender != contractorAddress) revert();
        if (task.status != TaskStatus.pending) revert();
        if (block.timestamp > task.deadlineTime) revert();
        
        task.status = TaskStatus.reportedComplete;
        task.completionTime = block.timestamp;
        task.ipfsProofHash = _ipfsProofHash; // Store IPFS hash of proof (photos, geolocation, etc.)
        
        // Trigger verification process
        task.status = TaskStatus.underVerification;
    }

    function verifyTask(
        uint _taskIndex, 
        bool _isApproved, 
        string memory _comments,
        string memory _verifierProofHash
    ) public payable returns (bool) {
        if (_taskIndex >= tasks.length) revert();
        Task storage task = tasks[_taskIndex];

        require(
            task.status == TaskStatus.underVerification || task.status == TaskStatus.reportedComplete, 
            "Task not ready for verification"
        );
        
        bool isGovOfficer = (msg.sender == governmentOfficerAddress);
        bool verifierAssigned = isAssignedVerifier[msg.sender];
        
        require(isGovOfficer || verifierAssigned, "Not authorized to verify");
        
        // Third-party verifiers must stake
        uint256 stakeId = 0;
        if (!isGovOfficer) {
            require(msg.value >= 0.1 ether, "Insufficient verification stake");
            stakeId = stakeManager.createStake{value: msg.value}(
                StakeManager.StakeType.MILESTONE_VERIFICATION, 
                address(this)
            );
        }
        
        // Record verification
        milestoneVerifications[_taskIndex].push(MilestoneVerification({
            verifier: msg.sender,
            isApproved: _isApproved,
            comments: _comments,
            timestamp: block.timestamp,
            stakeId: stakeId,
            ipfsProofHash: _verifierProofHash
        }));
        
        if (_isApproved) {
            task.verificationCount++;
        }
        
        // Check if enough verifications received
        if (task.verificationCount >= task.requiredVerifications) {
            task.status = TaskStatus.complete;
        } else if (!_isApproved && isGovOfficer) {
            // Government officer rejection overrides
            task.status = TaskStatus.verificationRejected;
        }
        
        return true;
    }

    function withdrawForTask(uint _taskIndex) public payable onlyContractor returns (bool) {
        if (_taskIndex >= tasks.length) revert();
        Task storage task = tasks[_taskIndex];

        if (msg.sender != contractorAddress) revert();
        if (task.status != TaskStatus.complete) revert();

        uint amount = task.amount*(1 ether);
        task.status = TaskStatus.contractorPaid;
        payable(msg.sender).transfer(amount);
        return true;
    }
    
    function getMilestoneVerifications(uint _taskIndex) public view returns (MilestoneVerification[] memory) {
        require(_taskIndex < tasks.length, "Invalid task index");
        return milestoneVerifications[_taskIndex];
    }
    
    function getAssignedVerifiers() public view returns (address[] memory) {
        return assignedVerifiers;
    }
    
    function addVerifier(address _verifier) public onlyGovernmentOfficer {
        require(!isAssignedVerifier[_verifier], "Verifier already assigned");
        assignedVerifiers.push(_verifier);
        isAssignedVerifier[_verifier] = true;
    }
    
    function removeVerifier(address _verifier) public onlyGovernmentOfficer {
        require(isAssignedVerifier[_verifier], "Verifier not assigned");
        isAssignedVerifier[_verifier] = false;
        
        // Remove from array
        for (uint i = 0; i < assignedVerifiers.length; i++) {
            if (assignedVerifiers[i] == _verifier) {
                assignedVerifiers[i] = assignedVerifiers[assignedVerifiers.length - 1];
                assignedVerifiers.pop();
                break;
            }
        }
    }
    
    function getTasksByStatus(TaskStatus _status) public view returns (uint[] memory) {
        uint[] memory taskIndices = new uint[](tasks.length);
        uint count = 0;
        
        for (uint i = 0; i < tasks.length; i++) {
            if (tasks[i].status == _status) {
                taskIndices[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint[] memory result = new uint[](count);
        for (uint i = 0; i < count; i++) {
            result[i] = taskIndices[i];
        }
        
        return result;
    }
}
