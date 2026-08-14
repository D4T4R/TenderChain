# TenderChain - Enhanced Blockchain Tender Management System

## 🎯 Overview
TenderChain is a comprehensive blockchain-based tender management system with enhanced features for transparency, stake-based security, and multi-party verification.

## 📁 Project Structure

```
tendersystem-blockchain/
├── README.md                    # This file
├── package.json                 # Truffle / solc tooling
├── truffle-config.js            # Truffle configuration
├── technical-details.html       # Technical documentation (architecture, algorithms)
│
├── contracts/                   # Smart contracts
│   └── access/TenderRoles.sol   # Shared AccessControl roles
├── migrations/                  # Deployment scripts (incl. 5_configure_roles.js)
├── test/                        # Truffle tests
├── build/contracts/             # Compiled artifacts (ABI source for the frontend)
│
├── backend/                     # Node.js backend (MongoDB + APIs)
│
├── frontend-next/               # Next.js app - the only frontend
│   └── src/
│       ├── app/                 # Landing page + role dashboards
│       ├── components/          # Shared UI
│       └── lib/
│           ├── api/             # Backend API client
│           ├── contracts/       # Generated ABIs + addresses
│           └── web3/            # Wallet provider and contract hooks
│
├── scripts/generate-abis.mjs    # Regenerates frontend ABIs from build/contracts
│
├── src/scripts/                 # Utility shell scripts
│
└── docs/                        # Documentation
```

### Frontend

The four role dashboards (officer, contractor, verifier, public) live in
`frontend-next/`. It requires **Node.js >= 20.9**; an `.nvmrc` pins 22.

```bash
npx truffle compile              # produce build/contracts
npm run generate:abis            # regenerate frontend-next ABIs
cp frontend-next/.env.local.example frontend-next/.env.local
# paste the addresses printed by `npx truffle migrate` into .env.local
npm run frontend                 # http://localhost:3002
```

ABIs are generated from `build/contracts`, never edited by hand.

## 🚀 Quick Start

### Prerequisites
- Node.js **>= 20.9** (required by Next.js; `frontend-next/.nvmrc` pins 22)
- Ganache CLI or Ganache GUI for native blockchain
- MetaMask browser extension for authorization
- IPFS for decentralized media storage

### Setup
1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Ganache:**
   ```bash
   ./src/scripts/setup.sh
   ```

3. **Deploy contracts:**
   ```bash
   npx truffle migrate --reset --network development
   ```

4. **Configure and start the frontend:**
   ```bash
   npm run generate:abis
   cp frontend-next/.env.local.example frontend-next/.env.local
   # paste the addresses printed by step 3 into .env.local
   npm run frontend
   ```

5. **Access the application:**
   - App: http://localhost:3002
   - Pick a role dashboard from the landing page

### Test the System
```bash
node src/scripts/test_enhanced_system.js
```

## 🏗️ System Features

### Core Functionality
- **Multi-user System**: Government Officers, Contractors, Verifiers
- **Tender Management**: Complete lifecycle from creation to completion
- **Contract Management**: Milestone-based project execution
- **Verification System**: Third-party verification with stakes

### Enhanced Features
- **Stake-based Security**: Economic incentives for honest participation
- **Public Transparency**: Community monitoring and corruption reporting
- **IPFS Integration**: Immutable evidence and proof storage
- **Encrypted Bidding**: Secure bid submission with key-based decryption

## 🔗 Contract Addresses (Local Deployment)

Key contracts deployed on local Ganache:
- **FactoryTender**: `0xeea2Fc1D255Fd28aA15c6c2324Ad40B03267f9c5`
- **StakeManager**: `0xe97DbD7116D168190F8A6E7beB1092c103c53a12`
- **PublicClaims**: `0xF16165f1046f1B3cDB37dA25E835B986E696313A`
- **FactoryVerifier**: `0x8914a9E5C5E234fDC3Ce9dc155ec19F43947ab59`

*Full contract list available in: `build/contracts/`*

## 👥 User Roles

### 1. Government Officer
- Create and manage tenders
- Approve contractors
- Assign verifiers to contracts
- Monitor project progress

### 2. Contractor/Bidder
- Register with KYC information
- Submit bids on tenders
- Execute awarded contracts
- Report milestone completion

### 3. Verifier
- Register as professional verifier
- Verify contract milestones
- Stake tokens for verification
- Build reputation through accurate verification

## 📚 Documentation

Detailed documentation available in the `docs/` directory:
- [Enhanced Deployment Summary](docs/ENHANCED_DEPLOYMENT_SUMMARY.md)
- [Backend Architecture](docs/BACKEND_ARCHITECTURE.md)
- [MetaMask Setup Guide](docs/METAMASK_SETUP_GUIDE.md)
- [Project Analysis & Fixes](docs/PROJECT_ANALYSIS_AND_FIXES.md)

## 🔧 Development

### Backend Development
The backend API is built with Node.js, Express, and MongoDB:
```bash
cd backend
npm install
npm run dev
```

### Frontend Development
Dashboards are React pages under `frontend-next/src/app/`, sharing UI from `frontend-next/src/components/`.

### Smart Contract Development
Contracts are in the `contracts/` directory. After making changes:
```bash
npx truffle compile
npx truffle migrate --reset --network development
```

## 🛡️ Security Features

- **Economic Security**: Stake-based participation prevents malicious behavior
- **Multi-party Verification**: Multiple independent verifiers for milestone approval
- **Transparent Operations**: All actions recorded on blockchain
- **IPFS Evidence Storage**: Immutable proof and evidence storage

## 📞 Support

For issues and support:
1. Check the documentation in `docs/`
2. Review contract deployment status with test script
3. Verify Ganache connection and MetaMask setup

## 📄 License

This project is developed for educational and demonstration purposes.

---

**Status**: 🚧 In development — local demo only, **not production ready**  
**Last Updated**: Enhanced system with stake-based security and transparency features  
**Network**: Local Ganache only (testnet/mainnet deployment is not yet safe)

> **Warning**
> Do not deploy this system to a public network or use it with real funds.
> Smart contract access control is still being implemented and the backend API
> has no authentication layer yet.
