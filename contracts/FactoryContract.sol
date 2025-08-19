// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./Contract.sol";


contract FactoryContract {
    Contract[] allContracts;

    function createContract(address govtOfficerAddress,
        address _contractorAddress, string memory _contractName, string memory _tenderId, 
        uint _completionTime, 
        string[] memory  _constraints, 
        uint _finalQuotationAmount,
        string[] memory  _taskDescription, 
        uint[] memory _deadlineForEachTask, 
        uint[] memory  _amountForEachTask,
        address[] memory _assignedVerifiers,
        address _stakeManagerAddress) public payable returns (Contract) {
        
        Contract newContract = new Contract();
        
        newContract.setContractBasic(govtOfficerAddress, 
        _contractorAddress, 
        _tenderId,
        _completionTime,
        _constraints,
        _assignedVerifiers,
        _stakeManagerAddress
        );
// string memory  _contractName, 
//         uint _finalQuotationAmount,
//         string[] memory  _taskDescription, 
//         uint[] memory  _deadlineForEachTask, 
//         uint[] memory  _amountForEachTask
        newContract.setContractAdvanced(_contractName, 
        _finalQuotationAmount,
        _taskDescription, 
        _deadlineForEachTask, 
        _amountForEachTask);

        allContracts.push(newContract);
        return newContract;
    }
}