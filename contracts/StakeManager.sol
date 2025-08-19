// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

contract StakeManager {
    
    struct Stake {
        address staker;
        uint256 amount;
        uint256 timestamp;
        StakeType stakeType;
        address relatedContract; // contract/tender/claim this stake is for
        bool isActive;
        bool isSlashed; // true if stake was slashed due to false verification
    }
    
    enum StakeType {
        VERIFIER_REGISTRATION,
        MILESTONE_VERIFICATION,
        PUBLIC_CLAIM,
        VOTE_ON_CLAIM,
        CONTRACTOR_EMD // Earnest Money Deposit
    }
    
    mapping(address => uint256) public totalStakedByAddress;
    mapping(address => Stake[]) public stakesByAddress;
    mapping(address => mapping(StakeType => uint256)) public stakeAmountByType;
    
    // Global stake tracking
    Stake[] public allStakes;
    mapping(uint256 => bool) public stakeExists;
    
    // Minimum stake amounts for different actions
    uint256 public constant MIN_VERIFIER_STAKE = 1 ether;
    uint256 public constant MIN_VERIFICATION_STAKE = 0.1 ether;
    uint256 public constant MIN_CLAIM_STAKE = 0.5 ether;
    uint256 public constant MIN_VOTE_STAKE = 0.05 ether;
    
    // Events
    event StakeCreated(address indexed staker, uint256 amount, StakeType stakeType, address indexed relatedContract);
    event StakeReleased(address indexed staker, uint256 amount, address indexed relatedContract);
    event StakeSlashed(address indexed staker, uint256 amount, string reason);
    
    modifier validStakeAmount(StakeType _stakeType) {
        if (_stakeType == StakeType.VERIFIER_REGISTRATION) {
            require(msg.value >= MIN_VERIFIER_STAKE, "Insufficient verifier registration stake");
        } else if (_stakeType == StakeType.MILESTONE_VERIFICATION) {
            require(msg.value >= MIN_VERIFICATION_STAKE, "Insufficient verification stake");
        } else if (_stakeType == StakeType.PUBLIC_CLAIM) {
            require(msg.value >= MIN_CLAIM_STAKE, "Insufficient claim stake");
        } else if (_stakeType == StakeType.VOTE_ON_CLAIM) {
            require(msg.value >= MIN_VOTE_STAKE, "Insufficient vote stake");
        }
        _;
    }
    
    function createStake(StakeType _stakeType, address _relatedContract) 
        external 
        payable 
        validStakeAmount(_stakeType) 
        returns (uint256) {
        
        Stake memory newStake = Stake({
            staker: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            stakeType: _stakeType,
            relatedContract: _relatedContract,
            isActive: true,
            isSlashed: false
        });
        
        stakesByAddress[msg.sender].push(newStake);
        allStakes.push(newStake);
        uint256 stakeId = allStakes.length - 1;
        stakeExists[stakeId] = true;
        
        totalStakedByAddress[msg.sender] += msg.value;
        stakeAmountByType[msg.sender][_stakeType] += msg.value;
        
        emit StakeCreated(msg.sender, msg.value, _stakeType, _relatedContract);
        return stakeId;
    }
    
    function releaseStake(uint256 _stakeId) external returns (bool) {
        require(stakeExists[_stakeId], "Stake does not exist");
        require(_stakeId < allStakes.length, "Invalid stake ID");
        
        Stake storage stake = allStakes[_stakeId];
        require(stake.staker == msg.sender, "Not stake owner");
        require(stake.isActive, "Stake already released");
        require(!stake.isSlashed, "Stake has been slashed");
        
        stake.isActive = false;
        totalStakedByAddress[msg.sender] -= stake.amount;
        stakeAmountByType[msg.sender][stake.stakeType] -= stake.amount;
        
        payable(msg.sender).transfer(stake.amount);
        
        emit StakeReleased(msg.sender, stake.amount, stake.relatedContract);
        return true;
    }
    
    function slashStake(uint256 _stakeId, string memory _reason) external returns (bool) {
        require(stakeExists[_stakeId], "Stake does not exist");
        require(_stakeId < allStakes.length, "Invalid stake ID");
        
        Stake storage stake = allStakes[_stakeId];
        require(stake.isActive, "Stake already processed");
        require(!stake.isSlashed, "Stake already slashed");
        
        // Only authorized contracts can slash stakes
        // This should be called by contract logic that determines false verification
        stake.isActive = false;
        stake.isSlashed = true;
        
        totalStakedByAddress[stake.staker] -= stake.amount;
        stakeAmountByType[stake.staker][stake.stakeType] -= stake.amount;
        
        emit StakeSlashed(stake.staker, stake.amount, _reason);
        return true;
    }
    
    function getStakesByAddress(address _staker) external view returns (Stake[] memory) {
        return stakesByAddress[_staker];
    }
    
    function getActiveStakesByType(address _staker, StakeType _stakeType) external view returns (uint256) {
        return stakeAmountByType[_staker][_stakeType];
    }
    
    function getTotalStakedAmount() external view returns (uint256) {
        return address(this).balance;
    }
    
    function hasMinimumStake(address _staker, StakeType _stakeType) external view returns (bool) {
        uint256 stakedAmount = stakeAmountByType[_staker][_stakeType];
        
        if (_stakeType == StakeType.VERIFIER_REGISTRATION) {
            return stakedAmount >= MIN_VERIFIER_STAKE;
        } else if (_stakeType == StakeType.MILESTONE_VERIFICATION) {
            return stakedAmount >= MIN_VERIFICATION_STAKE;
        } else if (_stakeType == StakeType.PUBLIC_CLAIM) {
            return stakedAmount >= MIN_CLAIM_STAKE;
        } else if (_stakeType == StakeType.VOTE_ON_CLAIM) {
            return stakedAmount >= MIN_VOTE_STAKE;
        }
        
        return false;
    }
}
