# TenderChain - Enhanced Blockchain Tender Management System

## 🎯 Overview
TenderChain is a comprehensive blockchain-based tender management system with enhanced features for transparency, stake-based security, and multi-party verification.

## 📁 Project Structure

```
tendersystem-blockchain/
├── README.md                    # This file
├── index.html                   # Main landing page
├── package.json                 # Node.js dependencies
├── truffle-config.js           # Truffle configuration
├── web3.min.js                 # Web3 library
│
├── contracts/                   # Smart contracts
├── migrations/                  # Deployment scripts
├── build/                      # Compiled contracts
├── backend/                    # Node.js backend (MongoDB + APIs)
├── frontend/                   # Frontend assets
├── web3/                       # Web3 configurations and contracts
│
├── src/
│   ├── dashboards/             # Modern dashboard files
│   │   ├── dashboardGovernmentOfficer-modern.html
│   │   ├── dashboardContractor-modern.html
│   │   └── dashboardVerifier-modern.html
│   ├── auth/                   # Authentication pages
│   │   ├── login-fixed.html
│   │   ├── login-new.html
│   │   └── register-fixed.html
│   └── scripts/                # Utility scripts
│       ├── setup.sh
│       ├── stop.sh
│       ├── quick-start.sh
│       └── test_enhanced_system.js
│
└── docs/                       # Documentation
    ├── ENHANCED_DEPLOYMENT_SUMMARY.md
    ├── BACKEND_ARCHITECTURE.md
    ├── PROJECT_ANALYSIS_AND_FIXES.md
    ├── METAMASK_SETUP_GUIDE.md
    └── README.md (original)
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- Ganache CLI or Ganache GUI
- MetaMask browser extension

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

4. **Start frontend server:**
   ```bash
   python3 -m http.server 3000
   ```

5. **Access the application:**
   - Main page: http://localhost:3000
   - Login: http://localhost:3000/src/auth/login-fixed.html

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

*Full contract list available in: `web3/contracts.js`*

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
Modern dashboards are located in `src/dashboards/`. Each dashboard is a self-contained HTML file with embedded JavaScript and CSS.

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

**Status**: ✅ Production Ready  
**Last Updated**: Enhanced system with stake-based security and transparency features  
**Network**: Local Ganache (configurable for testnets/mainnet)
