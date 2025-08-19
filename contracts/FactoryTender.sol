// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./Tender.sol";


contract FactoryTender {
    Tender[] allTenders;

    function createTender(
        address governmentOfficerAddress, 
        string memory tenderName, 
        string memory tenderId, 
        uint bidSubmissionClosingDate, 
        uint bidOpeningDate, 
        uint covers, 
        string memory tenderCategory,
        uint256 minimumEMD,
        string[] memory clauses,
        string[] memory taskName, 
        uint[] memory taskDays, 
        string[] memory constraints,
        address stakeManagerAddress
    ) public returns (Tender) {
        Tender newTender = new Tender();
        newTender.setTenderBasic(
            governmentOfficerAddress, 
            tenderName, 
            tenderId, 
            bidSubmissionClosingDate, 
            bidOpeningDate, 
            covers,
            tenderCategory,
            minimumEMD,
            stakeManagerAddress
        );
        newTender.setTenderAdvanced(clauses, taskName, taskDays, constraints);
        allTenders.push(newTender);
        return newTender;
    }

    // Getter functions to retrieve created tenders
    function getAllTenders() public view returns (Tender[] memory) {
        return allTenders;
    }

    function getTenderCount() public view returns (uint256) {
        return allTenders.length;
    }

    function getTenderAt(uint256 index) public view returns (Tender) {
        require(index < allTenders.length, "Index out of bounds");
        return allTenders[index];
    }
}
