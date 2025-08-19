// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./StakeManager.sol";

contract PublicClaims {
    
    struct Claim {
        uint256 claimId;
        address claimant;
        address targetContract;
        string description;
        string evidence; // IPFS hash of evidence documents
        uint256 timestamp;
        ClaimStatus status;
        uint256 totalStakeAmount;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 stakeFor;
        uint256 stakeAgainst;
        bool pilFiled;
        mapping(address => Vote) votes;
        address[] voters;
    }
    
    struct Vote {
        bool hasVoted;
        bool inFavor;
        uint256 stakeAmount;
        uint256 stakeId;
    }
    
    enum ClaimStatus {
        ACTIVE,
        THRESHOLD_REACHED,
        PIL_FILED,
        RESOLVED,
        REJECTED
    }
    
    // Contract state
    uint256 public nextClaimId;
    mapping(uint256 => Claim) public claims;
    uint256[] public allClaimIds;
    
    // Thresholds
    uint256 public constant MIN_CLAIM_STAKE = 0.5 ether;
    uint256 public constant MIN_VOTE_STAKE = 0.05 ether;
    uint256 public constant PIL_THRESHOLD_STAKE = 10 ether; // 10 ETH worth of support needed
    uint256 public constant MIN_VOTES_FOR_PIL = 5; // At least 5 votes in favor
    
    StakeManager public stakeManager;
    
    // Events
    event ClaimCreated(uint256 indexed claimId, address indexed claimant, address indexed targetContract);
    event VoteCast(uint256 indexed claimId, address indexed voter, bool inFavor, uint256 stakeAmount);
    event PILThresholdReached(uint256 indexed claimId, uint256 totalStake, uint256 votesFor);
    event PILFiled(uint256 indexed claimId, string pilReference);
    event ClaimResolved(uint256 indexed claimId, bool upheld);
    
    constructor(address _stakeManagerAddress) {
        stakeManager = StakeManager(_stakeManagerAddress);
        nextClaimId = 1;
    }
    
    function createClaim(
        address _targetContract,
        string memory _description,
        string memory _evidence
    ) external payable returns (uint256) {
        require(msg.value >= MIN_CLAIM_STAKE, "Insufficient claim stake");
        require(bytes(_description).length > 0, "Description cannot be empty");
        
        uint256 claimId = nextClaimId++;
        Claim storage newClaim = claims[claimId];
        
        newClaim.claimId = claimId;
        newClaim.claimant = msg.sender;
        newClaim.targetContract = _targetContract;
        newClaim.description = _description;
        newClaim.evidence = _evidence;
        newClaim.timestamp = block.timestamp;
        newClaim.status = ClaimStatus.ACTIVE;
        newClaim.totalStakeAmount = msg.value;
        
        allClaimIds.push(claimId);
        
        // Create stake for the claim
        uint256 stakeId = stakeManager.createStake{value: msg.value}(
            StakeManager.StakeType.PUBLIC_CLAIM,
            _targetContract
        );
        
        emit ClaimCreated(claimId, msg.sender, _targetContract);
        return claimId;
    }
    
    function voteOnClaim(uint256 _claimId, bool _inFavor) external payable {
        require(msg.value >= MIN_VOTE_STAKE, "Insufficient vote stake");
        require(claims[_claimId].claimId != 0, "Claim does not exist");
        require(claims[_claimId].status == ClaimStatus.ACTIVE, "Claim not active");
        require(!claims[_claimId].votes[msg.sender].hasVoted, "Already voted");
        
        Claim storage claim = claims[_claimId];
        
        // Create stake for the vote
        uint256 stakeId = stakeManager.createStake{value: msg.value}(
            StakeManager.StakeType.VOTE_ON_CLAIM,
            claim.targetContract
        );
        
        // Record the vote
        claim.votes[msg.sender] = Vote({
            hasVoted: true,
            inFavor: _inFavor,
            stakeAmount: msg.value,
            stakeId: stakeId
        });
        
        claim.voters.push(msg.sender);
        
        if (_inFavor) {
            claim.votesFor++;
            claim.stakeFor += msg.value;
        } else {
            claim.votesAgainst++;
            claim.stakeAgainst += msg.value;
        }
        
        claim.totalStakeAmount += msg.value;
        
        emit VoteCast(_claimId, msg.sender, _inFavor, msg.value);
        
        // Check if PIL threshold is reached
        if (claim.stakeFor >= PIL_THRESHOLD_STAKE && claim.votesFor >= MIN_VOTES_FOR_PIL) {
            claim.status = ClaimStatus.THRESHOLD_REACHED;
            emit PILThresholdReached(_claimId, claim.stakeFor, claim.votesFor);
        }
    }
    
    function filePIL(uint256 _claimId, string memory _pilReference) external {
        require(claims[_claimId].claimId != 0, "Claim does not exist");
        require(claims[_claimId].status == ClaimStatus.THRESHOLD_REACHED, "Threshold not reached");
        require(msg.sender == claims[_claimId].claimant, "Only claimant can file PIL");
        
        Claim storage claim = claims[_claimId];
        claim.status = ClaimStatus.PIL_FILED;
        claim.pilFiled = true;
        
        emit PILFiled(_claimId, _pilReference);
    }
    
    function resolveClaim(uint256 _claimId, bool _upheld) external {
        require(claims[_claimId].claimId != 0, "Claim does not exist");
        require(claims[_claimId].status == ClaimStatus.PIL_FILED, "PIL not filed");
        // Note: In practice, this should be called by an authorized authority after investigation
        
        Claim storage claim = claims[_claimId];
        claim.status = _upheld ? ClaimStatus.RESOLVED : ClaimStatus.REJECTED;
        
        // Handle stakes based on resolution
        if (_upheld) {
            // Claim was upheld - voters in favor get rewards, against get slashed
            _handleStakeResolution(_claimId, true);
        } else {
            // Claim was rejected - voters against get rewards, in favor get slashed
            _handleStakeResolution(_claimId, false);
        }
        
        emit ClaimResolved(_claimId, _upheld);
    }
    
    function _handleStakeResolution(uint256 _claimId, bool _claimUpheld) internal {
        Claim storage claim = claims[_claimId];
        
        for (uint i = 0; i < claim.voters.length; i++) {
            address voter = claim.voters[i];
            Vote storage vote = claim.votes[voter];
            
            bool voterWasCorrect = (vote.inFavor == _claimUpheld);
            
            if (voterWasCorrect) {
                // Release stake for correct voters
                stakeManager.releaseStake(vote.stakeId);
            } else {
                // Slash stake for incorrect voters
                stakeManager.slashStake(vote.stakeId, "Incorrect claim vote");
            }
        }
    }
    
    function getClaim(uint256 _claimId) external view returns (
        address claimant,
        address targetContract,
        string memory description,
        string memory evidence,
        uint256 timestamp,
        ClaimStatus status,
        uint256 totalStakeAmount,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 stakeFor,
        uint256 stakeAgainst,
        bool pilFiled
    ) {
        require(claims[_claimId].claimId != 0, "Claim does not exist");
        
        Claim storage claim = claims[_claimId];
        return (
            claim.claimant,
            claim.targetContract,
            claim.description,
            claim.evidence,
            claim.timestamp,
            claim.status,
            claim.totalStakeAmount,
            claim.votesFor,
            claim.votesAgainst,
            claim.stakeFor,
            claim.stakeAgainst,
            claim.pilFiled
        );
    }
    
    function getClaimsForContract(address _contractAddress) external view returns (uint256[] memory) {
        uint256[] memory contractClaims = new uint256[](allClaimIds.length);
        uint256 count = 0;
        
        for (uint i = 0; i < allClaimIds.length; i++) {
            if (claims[allClaimIds[i]].targetContract == _contractAddress) {
                contractClaims[count] = allClaimIds[i];
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint i = 0; i < count; i++) {
            result[i] = contractClaims[i];
        }
        
        return result;
    }
    
    function getAllClaims() external view returns (uint256[] memory) {
        return allClaimIds;
    }
    
    function getClaimsByStatus(ClaimStatus _status) external view returns (uint256[] memory) {
        uint256[] memory statusClaims = new uint256[](allClaimIds.length);
        uint256 count = 0;
        
        for (uint i = 0; i < allClaimIds.length; i++) {
            if (claims[allClaimIds[i]].status == _status) {
                statusClaims[count] = allClaimIds[i];
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint i = 0; i < count; i++) {
            result[i] = statusClaims[i];
        }
        
        return result;
    }
    
    function hasVoted(uint256 _claimId, address _voter) external view returns (bool) {
        return claims[_claimId].votes[_voter].hasVoted;
    }
    
    function getVote(uint256 _claimId, address _voter) external view returns (bool voterHasVoted, bool inFavor, uint256 stakeAmount) {
        Vote storage vote = claims[_claimId].votes[_voter];
        return (vote.hasVoted, vote.inFavor, vote.stakeAmount);
    }
}
