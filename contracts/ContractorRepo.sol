// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./access/TenderRoles.sol";

contract ContractorRepo is TenderRoles {
    address[] contractors; //all contractors verified + unverified
    address[] verifiedContractors;

    mapping (address=>bool) verifiedStatus; //false => unverified, true => verified
    mapping (address=>address) contratorToVerifier;
    mapping (address=>address) public walletAddressToNode;
    mapping (address=>bool) public isRegisteredContractor;

    event ContractorRegistered(address indexed wallet, address indexed node);
    event ContractorVerified(address indexed contractor, address indexed verifier);

    constructor(address admin) TenderRoles(admin) {}

    function newContractor(address walletAddress, address nodeAddress)
        public
        onlyRole(REGISTRAR_ROLE)
        returns (bool)
    {
        require(walletAddress != address(0), "ContractorRepo: zero wallet");
        require(nodeAddress != address(0), "ContractorRepo: zero node");
        require(!isRegisteredContractor[nodeAddress], "ContractorRepo: already registered");

        contractors.push(nodeAddress);
        isRegisteredContractor[nodeAddress] = true;
        verifiedStatus[nodeAddress] = false;
        _mapWalletAddressToNode(walletAddress, nodeAddress);

        emit ContractorRegistered(walletAddress, nodeAddress);
        return true;
    }

    /**
     * @dev Internal. Previously this was a public function, which allowed any
     * address to repoint any wallet at any node contract - an identity
     * hijacking vector. It is now reachable only via newContractor.
     */
    function _mapWalletAddressToNode(address walletAddress, address nodeAddress) internal {
        walletAddressToNode[walletAddress] = nodeAddress;
    }

    function getNodeAddress(address walletAddress) public view returns (address) {
        return walletAddressToNode[walletAddress];
    }

    /**
     * @dev The verifier is taken from msg.sender rather than a parameter, so a
     * caller cannot attribute a verification to somebody else.
     */
    function verifyContractor(address contractorAddress)
        public
        onlyRole(VERIFIER_ROLE)
    {
        require(isRegisteredContractor[contractorAddress], "ContractorRepo: unknown contractor");
        require(!verifiedStatus[contractorAddress], "ContractorRepo: already verified");

        verifiedContractors.push(contractorAddress);
        verifiedStatus[contractorAddress] = true;
        contratorToVerifier[contractorAddress] = msg.sender;

        emit ContractorVerified(contractorAddress, msg.sender);
    }

    function getVerifiedContractorsCount() public view returns (uint256) {
        return verifiedContractors.length;
    }

    function getVerifiedContractors() public view returns (address[] memory) {
        return verifiedContractors;
    }

    function getVerifier(address contractorAddress) public view returns (address) {
        return contratorToVerifier[contractorAddress];
    }

    function getContractors() public view returns (address[] memory) {
        return contractors;
    }

    function getContractorsCount() public view returns (uint256) {
        return contractors.length;
    }

    function getVerificationStatus(address contractorAddress) public view returns (bool) {
        return verifiedStatus[contractorAddress];
    }

    function getUnverifiedContractors(uint256 index) public view returns (address) {
        //loop at web3
        require(index < contractors.length, "ContractorRepo: index out of bounds");
        if (!verifiedStatus[contractors[index]]) {
            return contractors[index];
        }
        revert("ContractorRepo: contractor already verified");
    }
}
