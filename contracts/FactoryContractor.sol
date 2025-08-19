// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./Contractor.sol";

contract FactoryContractor {
    address[] public allContractors;
    
    //----do not use---- adds the new contract to same byte code--useless shit.
    function registerNewContractor(
        address _walletAddress, 
        string memory _email, 
        string memory _name,
        string memory _phoneNumber, 
        string memory _panNumber, 
        string memory _gstNumber, 
        string[] memory _workCategories,
        uint256 _netWorth,
        string[] memory _previousProjects,
        uint256[] memory _previousProjectValues,
        address _stakeManagerAddress
    ) public returns (bool) {
        Contractor contractor = new Contractor();
        contractor.setContractor(
            _walletAddress, 
            _email, 
            _name,
            _phoneNumber, 
            _panNumber, 
            _gstNumber, 
            _workCategories,
            _netWorth,
            _previousProjects,
            _previousProjectValues,
            _stakeManagerAddress
        );
        allContractors.push(_walletAddress);
        return true;
    }
}