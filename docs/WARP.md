# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Repository purpose
- Decentralized Tender Management System built with Solidity smart contracts (Truffle) and a static web frontend that interacts via web3.js.

Core development commands
- Install deps: npm install
- Compile contracts: npm run compile
- Start local chain (Ganache CLI): npm run ganache
  - Default CLI port is 8545; see Networks below regarding port mismatch.
- Migrate/deploy contracts: npm run migrate
  - Use a specific network: truffle migrate --network development
  - Rerun a single migration: truffle migrate --f 2 --to 2 --reset
- Interactive Truffle console: npm run dev
  - Then within console: migrate --reset
- Serve the frontend (static): npm start
  - Serves repository root on http://localhost:3000

Testing
- Truffle tests (Mocha/Chai): truffle test
- Run a single test file: truffle test test/<file>.js
- Filter by test name: truffle test --grep "pattern"
- Note: test/ currently only contains a placeholder. Add tests to test/*.js or test/*.sol to use these commands.

Networks and ports
- There are two Truffle configurations in this repo:
  - truffle-config.js: development network at 127.0.0.1:7545
  - truffle.js: development network at 127.0.0.1:8545
- If you run npm run ganache (CLI), it defaults here to 8545, matching truffle.js.
- If you use Ganache GUI (often 7545), it matches truffle-config.js.
- To avoid confusion, pick one and run commands with an explicit config:
  - Use 8545 (CLI): truffle migrate --config truffle.js --reset
  - Use 7545 (GUI): truffle migrate --config truffle-config.js --reset

Project layout (high-level)
- Smart contracts (contracts/)
  - Main.sol: placeholder for shared helpers. Currently includes no-op auth/aggregation placeholders and pure getters; not used as an entrypoint.
  - Domain contracts encoding the tender workflow:
    - Tender.sol: defines a tender with basic/advanced metadata, proposal submission (bid), proposal verification state machine, and getters for proposals and settings.
    - Contract.sol: defines a post-award contract with tasks, verification flow (government officer), and payment withdrawal per task.
    - GovernmentOfficer.sol: officer profile and collections (tenders, contracts, past/expired), and bookkeeping for status transitions.
    - Contractor.sol: contractor profile, bids placed, and contracts with statuses.
    - Verifier.sol: verifier profile; records verified entities and documents.
    - FactoryTender.sol: factory that instantiates Tender contracts and populates their basic/advanced data, maintaining an in-memory list of tender instances.
  - Solidity version targeted: 0.8.16 (see compilers.solc in truffle-config.js).
- Migrations (migrations/)
  - 2_deploy_repos.js deploys repositories and core domain contracts: GovernmentOfficerRepo, TenderRepo, ContractRepo, ContractorRepo, plus Contract, Contractor, GovernmentOfficer, Tender, Verifier.
  - Ensure the corresponding *Repo.sol contracts exist and compile before running migrations against them.
- Web frontend (static files in repo root and web3/)
  - HTML entry points: index.html and role-specific dashboards (e.g., dashboardGovernmentOfficer.html, dashboardBiders.html, dashboardVerifier.html, dashboardNormal.html).
  - Web3 integration scripts: multiple role-specific web3_*.js and files under web3/ that contain ABI/address helpers (e.g., web3/contracts.js, web3/abi.js, web3/tempAddress.js). The frontend is served statically and connects to the local Ethereum JSON-RPC provider.

Typical local workflow
1) Start a local chain
   - Option A (CLI, 8545): npm run ganache
   - Option B (GUI, 7545): run Ganache GUI, keep the default port
2) Compile and deploy
   - Match Truffle to the chosen port by specifying the config file
     - CLI/8545: truffle compile --config truffle.js && truffle migrate --config truffle.js --reset
     - GUI/7545: truffle compile --config truffle-config.js && truffle migrate --config truffle-config.js --reset
3) Update frontend addresses/ABIs if required
   - If the web app expects hardcoded addresses/ABIs (e.g., web3/contracts.js, web3/abi.js or abi.js at root), update them after each fresh deployment.
4) Serve the frontend
   - npm start (http://localhost:3000) and interact via a web3-enabled browser (e.g., MetaMask configured to localhost network).

Solidity compiler and optimization
- The primary compiler is set in truffle-config.js to 0.8.16.
- truffle.js contains an optimizer stanza under networks by mistake; optimization should be configured under compilers.solc in truffle-config.js if desired:
  compilers: { solc: { version: "0.8.16", settings: { optimizer: { enabled: true, runs: 200 } } } }

Linting and formatting
- No lint or formatter is configured for Solidity or JS in package.json. If adding one, prefer:
  - Solidity: solhint and/or prettier-plugin-solidity
  - JS: eslint + prettier

Quick Start
- Run the automated setup: ./quick-start.sh
- This will start Ganache, deploy contracts, and serve the frontend
- Follow the MetaMask setup guide in METAMASK_SETUP_GUIDE.md
- Use register.html for registration and login-new.html for login

Fixed Issues (December 2024)
- ✅ Fixed critical modifier bugs in Contract.sol (onlyGovernmentOfficer and onlyContractor)
- ✅ Created modern web3 integration with MetaMask support
- ✅ Added proper registration/login system with verification status
- ✅ Updated contract addresses after deployment
- ✅ Created comprehensive setup documentation
- ✅ All repository contracts exist and are properly configured

Modern Web3 Integration
- web3/web3-init.js: Modern Web3Manager class with MetaMask integration
- web3/contracts.js: Updated contract addresses from latest deployment
- register.html: Complete registration system for officers and contractors
- login-new.html: Modern login system with verification status checking
- Automatic network detection and switching for MetaMask

Notes and caveats for agents
- Ports mismatch: Always choose and stick to either 8545 (CLI) or 7545 (GUI) per session, and pass the matching Truffle config explicitly with --config.
- Contract modifiers: Fixed critical security issues in Contract.sol modifiers (were using != instead of ==)
- All repository contracts exist and compile successfully
- Main.sol contains placeholder logic (encrypt/decrypt, aggregations) that return inert values. Do not assume on-chain auth; the dApp likely handles auth off-chain and passes addresses into contract methods.
- Payment logic in Contract.sol uses payable(msg.sender).transfer(amount) with amount scaled by 1 ether; ensure the contract is funded on deployment or before calling withdrawForTask.
- Tests: The test directory is empty; before relying on test commands, create mocha tests under test/.

