// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./access/TenderRoles.sol";

contract TenderRepo is TenderRoles {
    address[] public tenders;

    enum TenderStatus {
        activeOnBid,
        biddingComplete,
        contractDeployed
    }

    mapping (address => TenderStatus) public tenderMapping;
    mapping (address => bool) public isRegisteredTender;

    event TenderRegistered(address indexed tender, address indexed registrar);
    event TenderStatusChanged(address indexed tender, TenderStatus status);

    constructor(address admin) TenderRoles(admin) {}

    function newTender(address tenderToAppend)
        public
        onlyRole(REGISTRAR_ROLE)
        returns (bool)
    {
        require(tenderToAppend != address(0), "TenderRepo: zero address");
        require(!isRegisteredTender[tenderToAppend], "TenderRepo: already registered");

        tenders.push(tenderToAppend);
        isRegisteredTender[tenderToAppend] = true;
        tenderMapping[tenderToAppend] = TenderStatus.activeOnBid;

        emit TenderRegistered(tenderToAppend, msg.sender);
        return true;
    }

    function getTenderStatus(address tenderAddress) public view returns (TenderStatus) {
        return tenderMapping[tenderAddress];
    }

    function getAllTenders() public view returns (address[] memory ) {
        //to be used by verifier
        return tenders;
    }

    function getTenderCount() public view returns (uint256) {
        return tenders.length;
    }

    function getOngoingTenders(uint256 index) public view returns (address) {
        //loop at web3
        require(index < tenders.length, "TenderRepo: index out of bounds");
        if (tenderMapping[tenders[index]] == TenderStatus.activeOnBid) {
            return tenders[index];
        }
        revert("TenderRepo: tender not active on bid");
    }

    function updateTenderStatusToBiddingComplete(address tenderAddress)
        public
        onlyRole(STATUS_UPDATER_ROLE)
    {
        require(isRegisteredTender[tenderAddress], "TenderRepo: unknown tender");
        tenderMapping[tenderAddress] = TenderStatus.biddingComplete;
        emit TenderStatusChanged(tenderAddress, TenderStatus.biddingComplete);
    }

    function updateTenderStatusToDeployed(address tenderAddress)
        public
        onlyRole(STATUS_UPDATER_ROLE)
    {
        require(isRegisteredTender[tenderAddress], "TenderRepo: unknown tender");
        tenderMapping[tenderAddress] = TenderStatus.contractDeployed;
        emit TenderStatusChanged(tenderAddress, TenderStatus.contractDeployed);
    }
}
