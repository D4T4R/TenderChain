// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./Contract.sol";
import "./PublicClaims.sol";

contract PublicDashboard {
    
    struct ContractInfo {
        address contractAddress;
        string contractName;
        address governmentOfficer;
        address contractor;
        string tenderId;
        uint256 creationDate;
        uint256 completionDate;
        uint256 totalAmount;
        ContractStatus status;
    }
    
    struct ForumPost {
        uint256 postId;
        address author;
        string content;
        uint256 timestamp;
        address targetContract;
        uint256[] replies; // array of reply post IDs
        bool isReply;
        uint256 parentPostId; // 0 if not a reply
    }
    
    enum ContractStatus {
        ACTIVE,
        COMPLETED,
        DELAYED,
        DISPUTED
    }
    
    // State variables
    mapping(address => ContractInfo) public contractInfos;
    address[] public allContracts;
    
    // Forum functionality
    uint256 public nextPostId;
    mapping(uint256 => ForumPost) public forumPosts;
    mapping(address => uint256[]) public contractPosts; // contract => post IDs
    uint256[] public allPostIds;
    
    // Access control
    mapping(address => bool) public isAuthorizedUpdater;
    address public admin;
    
    PublicClaims public publicClaims;
    
    // Events
    event ContractAdded(address indexed contractAddress, string contractName, address indexed contractor);
    event ContractStatusUpdated(address indexed contractAddress, ContractStatus newStatus);
    event ForumPostCreated(uint256 indexed postId, address indexed author, address indexed targetContract);
    event ReplyAdded(uint256 indexed postId, uint256 indexed replyId, address indexed author);
    
    constructor(address _publicClaimsAddress) {
        admin = msg.sender;
        isAuthorizedUpdater[msg.sender] = true;
        publicClaims = PublicClaims(_publicClaimsAddress);
        nextPostId = 1;
    }
    
    modifier onlyAuthorized() {
        require(isAuthorizedUpdater[msg.sender] || msg.sender == admin, "Not authorized");
        _;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    function addAuthorizedUpdater(address _updater) external onlyAdmin {
        isAuthorizedUpdater[_updater] = true;
    }
    
    function removeAuthorizedUpdater(address _updater) external onlyAdmin {
        isAuthorizedUpdater[_updater] = false;
    }
    
    function addContract(
        address _contractAddress,
        string memory _contractName,
        address _governmentOfficer,
        address _contractor,
        string memory _tenderId,
        uint256 _completionDate,
        uint256 _totalAmount
    ) external onlyAuthorized {
        require(contractInfos[_contractAddress].contractAddress == address(0), "Contract already exists");
        
        contractInfos[_contractAddress] = ContractInfo({
            contractAddress: _contractAddress,
            contractName: _contractName,
            governmentOfficer: _governmentOfficer,
            contractor: _contractor,
            tenderId: _tenderId,
            creationDate: block.timestamp,
            completionDate: _completionDate,
            totalAmount: _totalAmount,
            status: ContractStatus.ACTIVE
        });
        
        allContracts.push(_contractAddress);
        
        emit ContractAdded(_contractAddress, _contractName, _contractor);
    }
    
    function updateContractStatus(address _contractAddress, ContractStatus _newStatus) external onlyAuthorized {
        require(contractInfos[_contractAddress].contractAddress != address(0), "Contract not found");
        contractInfos[_contractAddress].status = _newStatus;
        emit ContractStatusUpdated(_contractAddress, _newStatus);
    }
    
    function getContractInfo(address _contractAddress) external view returns (
        string memory contractName,
        address governmentOfficer,
        address contractor,
        string memory tenderId,
        uint256 creationDate,
        uint256 completionDate,
        uint256 totalAmount,
        ContractStatus status
    ) {
        require(contractInfos[_contractAddress].contractAddress != address(0), "Contract not found");
        ContractInfo storage info = contractInfos[_contractAddress];
        return (
            info.contractName,
            info.governmentOfficer,
            info.contractor,
            info.tenderId,
            info.creationDate,
            info.completionDate,
            info.totalAmount,
            info.status
        );
    }
    
    function getAllContracts() external view returns (address[] memory) {
        return allContracts;
    }
    
    function getContractsByStatus(ContractStatus _status) external view returns (address[] memory) {
        address[] memory statusContracts = new address[](allContracts.length);
        uint256 count = 0;
        
        for (uint i = 0; i < allContracts.length; i++) {
            if (contractInfos[allContracts[i]].status == _status) {
                statusContracts[count] = allContracts[i];
                count++;
            }
        }
        
        // Resize array to actual count
        address[] memory result = new address[](count);
        for (uint i = 0; i < count; i++) {
            result[i] = statusContracts[i];
        }
        
        return result;
    }
    
    // Forum functionality
    function createForumPost(address _targetContract, string memory _content) external returns (uint256) {
        require(contractInfos[_targetContract].contractAddress != address(0), "Contract not found");
        require(bytes(_content).length > 0, "Content cannot be empty");
        
        uint256 postId = nextPostId++;
        
        forumPosts[postId] = ForumPost({
            postId: postId,
            author: msg.sender,
            content: _content,
            timestamp: block.timestamp,
            targetContract: _targetContract,
            replies: new uint256[](0),
            isReply: false,
            parentPostId: 0
        });
        
        contractPosts[_targetContract].push(postId);
        allPostIds.push(postId);
        
        emit ForumPostCreated(postId, msg.sender, _targetContract);
        return postId;
    }
    
    function replyToPost(uint256 _parentPostId, string memory _content) external returns (uint256) {
        require(forumPosts[_parentPostId].postId != 0, "Parent post not found");
        require(bytes(_content).length > 0, "Content cannot be empty");
        
        uint256 replyId = nextPostId++;
        ForumPost storage parentPost = forumPosts[_parentPostId];
        
        forumPosts[replyId] = ForumPost({
            postId: replyId,
            author: msg.sender,
            content: _content,
            timestamp: block.timestamp,
            targetContract: parentPost.targetContract,
            replies: new uint256[](0),
            isReply: true,
            parentPostId: _parentPostId
        });
        
        parentPost.replies.push(replyId);
        contractPosts[parentPost.targetContract].push(replyId);
        allPostIds.push(replyId);
        
        emit ReplyAdded(_parentPostId, replyId, msg.sender);
        return replyId;
    }
    
    function getForumPost(uint256 _postId) external view returns (
        address author,
        string memory content,
        uint256 timestamp,
        address targetContract,
        uint256[] memory replies,
        bool isReply,
        uint256 parentPostId
    ) {
        require(forumPosts[_postId].postId != 0, "Post not found");
        ForumPost storage post = forumPosts[_postId];
        return (
            post.author,
            post.content,
            post.timestamp,
            post.targetContract,
            post.replies,
            post.isReply,
            post.parentPostId
        );
    }
    
    function getContractPosts(address _contractAddress) external view returns (uint256[] memory) {
        return contractPosts[_contractAddress];
    }
    
    function getAllPosts() external view returns (uint256[] memory) {
        return allPostIds;
    }
    
    function getContractMilestoneProgress(address _contractAddress) external view returns (
        uint256[] memory taskIndices,
        string[] memory taskDescriptions,
        uint256[] memory taskAmounts,
        uint8[] memory taskStatuses // 0=pending, 1=complete, 2=verified, 3=paid
    ) {
        // This function interfaces with the actual Contract to get milestone progress
        Contract contractInstance = Contract(_contractAddress);
        uint256 taskCount = contractInstance.getNumberOfTasks();
        
        taskIndices = new uint256[](taskCount);
        taskDescriptions = new string[](taskCount);
        taskAmounts = new uint256[](taskCount);
        taskStatuses = new uint8[](taskCount);
        
        for (uint i = 0; i < taskCount; i++) {
            (
                string memory description,
                ,
                uint256 amount,
                Contract.TaskStatus status,
                ,
                ,
                ,
            ) = contractInstance.getTask(i);
            
            taskIndices[i] = i;
            taskDescriptions[i] = description;
            taskAmounts[i] = amount;
            taskStatuses[i] = uint8(status);
        }
        
        return (taskIndices, taskDescriptions, taskAmounts, taskStatuses);
    }
    
    function getContractClaims(address _contractAddress) external view returns (uint256[] memory) {
        return publicClaims.getClaimsForContract(_contractAddress);
    }
    
    // Statistical functions for public dashboard
    function getTotalContracts() external view returns (uint256) {
        return allContracts.length;
    }
    
    function getActiveContractsCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint i = 0; i < allContracts.length; i++) {
            if (contractInfos[allContracts[i]].status == ContractStatus.ACTIVE) {
                count++;
            }
        }
        return count;
    }
    
    function getCompletedContractsCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint i = 0; i < allContracts.length; i++) {
            if (contractInfos[allContracts[i]].status == ContractStatus.COMPLETED) {
                count++;
            }
        }
        return count;
    }
    
    function getTotalContractValue() external view returns (uint256) {
        uint256 total = 0;
        for (uint i = 0; i < allContracts.length; i++) {
            total += contractInfos[allContracts[i]].totalAmount;
        }
        return total;
    }
    
    function getContractsByContractor(address _contractor) external view returns (address[] memory) {
        address[] memory contractorContracts = new address[](allContracts.length);
        uint256 count = 0;
        
        for (uint i = 0; i < allContracts.length; i++) {
            if (contractInfos[allContracts[i]].contractor == _contractor) {
                contractorContracts[count] = allContracts[i];
                count++;
            }
        }
        
        // Resize array to actual count
        address[] memory result = new address[](count);
        for (uint i = 0; i < count; i++) {
            result[i] = contractorContracts[i];
        }
        
        return result;
    }
}
