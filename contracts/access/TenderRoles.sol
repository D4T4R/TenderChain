// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TenderRoles
 * @notice Shared role definitions and base access control for the TenderChain system.
 *
 * The registries in this system are written to directly by externally owned
 * accounts (officers, verifiers) as well as by the factory contracts, so a
 * factory-only lock would break the normal flows. Roles are therefore scoped by
 * the action being performed rather than by the caller's contract type.
 *
 * Role model:
 *  - DEFAULT_ADMIN_ROLE  Deployer. Grants and revokes all other roles.
 *  - REGISTRAR_ROLE      May append new entries to the registries. Held by the
 *                        factory contracts and by the deployer during setup.
 *  - VERIFIER_ROLE       May mark contractors and officers as verified.
 *  - STATUS_UPDATER_ROLE May advance tender and contract lifecycle status.
 *  - SLASHER_ROLE        May slash a stake. Held by adjudicating contracts such
 *                        as PublicClaims, never by an EOA in production.
 */
abstract contract TenderRoles is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant STATUS_UPDATER_ROLE = keccak256("STATUS_UPDATER_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    constructor(address admin) {
        require(admin != address(0), "TenderRoles: admin is zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }
}
