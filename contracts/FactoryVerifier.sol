// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./Verifier.sol";

contract FactoryVerifier {
    address[] public allVerifiers;
    
    function registerNewVerifier(
        address _walletAddress, 
        string memory _email, 
        string memory _phoneNumber, 
        string memory _name, 
        string memory _employeeId,
        string[] memory _expertiseDomains,
        address _stakeManagerAddress
    ) public payable returns (bool) {
        Verifier verifier = new Verifier();
        verifier.setVerifier{value: msg.value}(
            _walletAddress, 
            _email, 
            _phoneNumber, 
            _name, 
            _employeeId,
            _expertiseDomains,
            _stakeManagerAddress
        );
        allVerifiers.push(_walletAddress);
        return true;
    }
    
    function getAllVerifiers() public view returns (address[] memory) {
        return allVerifiers;
    }
    
    function getVerifierCount() public view returns (uint256) {
        return allVerifiers.length;
    }
}
