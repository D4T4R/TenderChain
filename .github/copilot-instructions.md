## Repo quick-orientation — TenderChain (Blockchain)

This file gives concise, actionable guidance for AI coding agents to be productive in this repository.

1) Big picture (layers & data flow)
   - Smart contracts: `contracts/` (Solidity). Compiled artifacts (ABI + bytecode) live in `build/contracts/`.
   - Frontend: static HTML/JS under `src/`, `frontend/`, and top-level `index.html`. Frontend uses `web3/` utilities to talk to contracts.
   - Web3 layer & config: `web3/` and `web3/web3-init.js` — MetaMask connection, network switching, contract initialisation.
   - Backend API: `backend/` (Express + Mongoose). Entry: `backend/server.js`. Routes in `backend/routes/` and controllers in `backend/controllers/`.
   - Persistence: MongoDB for metadata (see `backend/config/database.js`) and IPFS for uploaded documents (IPFS hashes stored in DB).

2) Exact developer commands (use these; confirm paths in edits)
   - Install root deps: `npm install` (root) — this also supports truffle/ganache scripts.
   - Compile contracts: `npm run compile` (root) → runs `truffle compile`.
   - Migrate (deploy) locally: `npm run migrate` (root) or `npx truffle migrate --reset --network development`.
   - Start local blockchain: `npm run ganache` (root) or run `./src/scripts/setup.sh` as in README.
   - Serve frontend statically: `npm run start` (root) — serves repository on port 3000 via `serve`.
   - Backend dev: `cd backend && npm install && npm run dev` (nodemon). Prod: `npm start`.
   - Backend tests: `cd backend && npm test` (Jest). Integration check: `node src/scripts/test_enhanced_system.js` (root).

3) Project-specific conventions to follow
   - User identity is wallet-first: `walletAddress` links on-chain addresses to MongoDB user docs — edit both DB model and any contract call sites if you change naming.
   - IPFS usage: documents store IPFS hashes in DB. `backend/services/documentProcessor.js` is the canonical upload/processing flow.
   - Contract address flow: after `truffle migrate` update `web3/contracts.js` or verify `build/contracts/*` addresses are consumed by frontend. The frontend relies on `web3/` globals.
   - API surface: backend mounts API under `/api/*` (see `backend/server.js`). Keep routes and controllers consistent with `docs/BACKEND_ARCHITECTURE.md` schemas.

4) Integration points & gotchas
   - ABI/ABI-shape changes: recompile contracts and update any web3 contract initializers in `web3/web3-init.js` and frontend files referencing ABI names.
   - DB model edits: update Mongoose schema in `backend/models/` and adapt controllers/tests. Watch for fields like `documents.*` (IPFS hashes).
   - Environment variables: `MONGODB_URI`, `PORT`, `NODE_ENV`, `RATE_LIMIT_*` influence runtime; defaults are in `backend/config/database.js` and `backend/server.js`.
   - CORS: backend CORS origin list is environment-sensitive — check `backend/server.js` before changing frontend host/ports.

5) PR expectations for maintainers
   - Include: 1) list of files changed by layer (contracts / backend / frontend), 2) if contracts changed — compiled JSONs in `build/contracts/` or migration output/snapshots, 3) relevant test results (`cd backend && npm test` output or integration script logs).
   - Minimal reproducible steps: how to run the change locally (commands above) and any env vars required.

6) Files to open first when investigating
   - `backend/server.js` — middleware, routes mounting, graceful shutdown.
   - `backend/config/database.js` — DB connection string and defaults.
   - `web3/web3-init.js` & `web3/contracts.js` — MetaMask wiring and contract addresses.
   - `build/contracts/*.json` — ABI and deployed networks after migration.
   - `docs/BACKEND_ARCHITECTURE.md` — DB schemas and API contract reference.

If anything important is missing from this file or you want deeper integration guidance (CI, release, or tests), say which area and I will expand with exact file examples and commands.
