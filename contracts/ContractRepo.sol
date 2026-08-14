// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./access/TenderRoles.sol";

contract ContractRepo is TenderRoles {
    address[] public contractAddress;
    address[] public completedContracts; //used for quick access to Completed Contracts

    enum ContractStatus {
        onGoing,
        complete
    }

    mapping (address=>ContractStatus) public contractMapping;
    mapping (address=>bool) public isRegisteredContract;

    event ContractRegistered(address indexed contractAddr, address indexed registrar);
    event ContractCompleted(address indexed contractAddr);

    constructor(address admin) TenderRoles(admin) {}

    function addToContracts(address contractToAppend)
        public
        onlyRole(REGISTRAR_ROLE)
        returns (bool)
    {
        require(contractToAppend != address(0), "ContractRepo: zero address");
        require(!isRegisteredContract[contractToAppend], "ContractRepo: already registered");

        contractAddress.push(contractToAppend);
        isRegisteredContract[contractToAppend] = true;
        contractMapping[contractToAppend] = ContractStatus.onGoing;

        emit ContractRegistered(contractToAppend, msg.sender);
        return true;
    }

    function getAllContracts() public view returns (address[] memory) {
        return contractAddress;
    }

    function getContractCount() public view returns (uint256) {
        return contractAddress.length;
    }

    function getOngoingContracts(uint256 index) public view returns (address) {
        //loop at web3
        require(index < contractAddress.length, "ContractRepo: index out of bounds");
        if (contractMapping[contractAddress[index]] == ContractStatus.onGoing) {
            return contractAddress[index];
        }
        revert("ContractRepo: contract not ongoing");
    }

    function getCompletedContracts() public view returns (address[] memory) {
        return completedContracts;
    }

    function updateContractStatusToComplete(address _contractAddress)
        public
        onlyRole(STATUS_UPDATER_ROLE)
    {
        require(isRegisteredContract[_contractAddress], "ContractRepo: unknown contract");
        require(
            contractMapping[_contractAddress] != ContractStatus.complete,
            "ContractRepo: already complete"
        );

        contractMapping[_contractAddress] = ContractStatus.complete;
        completedContracts.push(_contractAddress);

        emit ContractCompleted(_contractAddress);
    }
}
