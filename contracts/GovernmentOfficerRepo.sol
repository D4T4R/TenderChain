// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./access/TenderRoles.sol";

contract GovernmentOfficerRepo is TenderRoles {
    address[] public officers; //all officers verified + unverified
    address[] public verifiedOfficers;
    mapping (address=>bool) public verifiedStatus; //true=>verified, false => unverified
    mapping (address=>address) public officerToVerifier;
    mapping (address=>address) public walletAddressToNode;
    mapping (address=>bool) public isRegisteredOfficer;

    event OfficerRegistered(address indexed wallet, address indexed node);
    event OfficerVerified(address indexed officer, address indexed verifier);

    constructor(address admin) TenderRoles(admin) {}

    function newOfficer(address walletAddress, address nodeAddress)
        public
        onlyRole(REGISTRAR_ROLE)
        returns (bool)
    {
        require(walletAddress != address(0), "OfficerRepo: zero wallet");
        require(nodeAddress != address(0), "OfficerRepo: zero node");
        require(!isRegisteredOfficer[nodeAddress], "OfficerRepo: already registered");

        officers.push(nodeAddress);
        isRegisteredOfficer[nodeAddress] = true;
        verifiedStatus[nodeAddress] = false;
        _mapWalletAddressToNode(walletAddress, nodeAddress);

        emit OfficerRegistered(walletAddress, nodeAddress);
        return true;
    }

    /**
     * @dev Internal. Previously public, which allowed any address to repoint any
     * wallet at any node contract - an identity hijacking vector.
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
    function verifyOfficer(address officerAddress)
        public
        onlyRole(VERIFIER_ROLE)
    {
        require(isRegisteredOfficer[officerAddress], "OfficerRepo: unknown officer");
        require(!verifiedStatus[officerAddress], "OfficerRepo: already verified");

        verifiedOfficers.push(officerAddress);
        verifiedStatus[officerAddress] = true;
        officerToVerifier[officerAddress] = msg.sender;

        emit OfficerVerified(officerAddress, msg.sender);
    }

    function getOfficersCount() public view returns (uint256) {
        return officers.length;
    }

    function getVerifiedOfficersCount() public view returns (uint256) {
        return verifiedOfficers.length;
    }

    function getOfficers () public view returns (address[] memory) {
        return officers;
    }

    function getVerifiedOfficers () public view returns (address[] memory) {
        return verifiedOfficers;
    }

    function getVerifier(address officerAddress) public view returns (address) {
        return officerToVerifier[officerAddress];
    }

    function getVerifiedStatus(address officerAddress) public view returns (bool) {
        return verifiedStatus[officerAddress];
    }

    function getUnverifiedOfficers(uint256 index) public view returns (address) {
        //loop at web3
        require(index < officers.length, "OfficerRepo: index out of bounds");
        if (!verifiedStatus[officers[index]]) {
            return officers[index];
        }
        revert("OfficerRepo: officer already verified");
    }
}
