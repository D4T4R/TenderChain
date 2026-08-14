// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./access/TenderRoles.sol";

contract StakeManager is TenderRoles, ReentrancyGuard {

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
    mapping(address => mapping(StakeType => uint256)) public stakeAmountByType;

    /**
     * @dev Stake ids owned by each address. This previously held full Stake
     * structs, which were copies of the entries in allStakes; releasing or
     * slashing only mutated allStakes, so the per-address copies reported
     * isActive == true forever. Storing ids keeps a single source of truth.
     */
    mapping(address => uint256[]) private stakeIdsByAddress;

    // Global stake tracking
    Stake[] public allStakes;
    mapping(uint256 => bool) public stakeExists;

    /// @notice Total slashed funds held by this contract, awaiting withdrawal.
    uint256 public slashedPool;

    // Minimum stake amounts for different actions
    uint256 public constant MIN_VERIFIER_STAKE = 1 ether;
    uint256 public constant MIN_VERIFICATION_STAKE = 0.1 ether;
    uint256 public constant MIN_CLAIM_STAKE = 0.5 ether;
    uint256 public constant MIN_VOTE_STAKE = 0.05 ether;

    // Events
    event StakeCreated(address indexed staker, uint256 amount, StakeType stakeType, address indexed relatedContract);
    event StakeReleased(address indexed staker, uint256 amount, address indexed relatedContract);
    event StakeSlashed(address indexed staker, uint256 amount, string reason);
    event SlashedFundsWithdrawn(address indexed to, uint256 amount);

    constructor(address admin) TenderRoles(admin) {}

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

        require(msg.value > 0, "StakeManager: zero stake");

        allStakes.push(Stake({
            staker: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            stakeType: _stakeType,
            relatedContract: _relatedContract,
            isActive: true,
            isSlashed: false
        }));

        uint256 stakeId = allStakes.length - 1;
        stakeExists[stakeId] = true;
        stakeIdsByAddress[msg.sender].push(stakeId);

        totalStakedByAddress[msg.sender] += msg.value;
        stakeAmountByType[msg.sender][_stakeType] += msg.value;

        emit StakeCreated(msg.sender, msg.value, _stakeType, _relatedContract);
        return stakeId;
    }

    function releaseStake(uint256 _stakeId) external nonReentrant returns (bool) {
        require(stakeExists[_stakeId], "Stake does not exist");
        require(_stakeId < allStakes.length, "Invalid stake ID");

        Stake storage stake = allStakes[_stakeId];
        require(stake.staker == msg.sender, "Not stake owner");
        require(stake.isActive, "Stake already released");
        require(!stake.isSlashed, "Stake has been slashed");

        uint256 amount = stake.amount;

        // Effects before interaction.
        stake.isActive = false;
        totalStakedByAddress[msg.sender] -= amount;
        stakeAmountByType[msg.sender][stake.stakeType] -= amount;

        // call rather than transfer: transfer forwards only 2300 gas, which
        // fails for any staker that is a contract with a receive hook.
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "StakeManager: ETH transfer failed");

        emit StakeReleased(msg.sender, amount, stake.relatedContract);
        return true;
    }

    /**
     * @notice Slash a stake. Restricted to SLASHER_ROLE, which is granted to
     * adjudicating contracts (for example PublicClaims) and never to an EOA in
     * production. Previously this function was callable by anybody, and the
     * slashed ETH was left permanently stranded in the contract.
     */
    function slashStake(uint256 _stakeId, string memory _reason)
        external
        onlyRole(SLASHER_ROLE)
        returns (bool)
    {
        require(stakeExists[_stakeId], "Stake does not exist");
        require(_stakeId < allStakes.length, "Invalid stake ID");

        Stake storage stake = allStakes[_stakeId];
        require(stake.isActive, "Stake already processed");
        require(!stake.isSlashed, "Stake already slashed");

        uint256 amount = stake.amount;

        stake.isActive = false;
        stake.isSlashed = true;

        totalStakedByAddress[stake.staker] -= amount;
        stakeAmountByType[stake.staker][stake.stakeType] -= amount;

        // Slashed value is accounted for so it can be withdrawn by the admin
        // rather than being locked in the contract forever.
        slashedPool += amount;

        emit StakeSlashed(stake.staker, amount, _reason);
        return true;
    }

    /**
     * @notice Withdraw accumulated slashed funds to a treasury address.
     */
    function withdrawSlashedFunds(address payable _to, uint256 _amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        require(_to != address(0), "StakeManager: zero recipient");
        require(_amount > 0 && _amount <= slashedPool, "StakeManager: invalid amount");

        slashedPool -= _amount;

        (bool ok, ) = _to.call{value: _amount}("");
        require(ok, "StakeManager: ETH transfer failed");

        emit SlashedFundsWithdrawn(_to, _amount);
    }

    function getStakesByAddress(address _staker) external view returns (Stake[] memory) {
        uint256[] storage ids = stakeIdsByAddress[_staker];
        Stake[] memory out = new Stake[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            out[i] = allStakes[ids[i]];
        }
        return out;
    }

    function getStakeIdsByAddress(address _staker) external view returns (uint256[] memory) {
        return stakeIdsByAddress[_staker];
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
