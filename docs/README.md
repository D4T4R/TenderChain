# 🏗️ TenderChain - Decentralized Tender Management System

A comprehensive blockchain-based tender bidding and contract management system built with Solidity smart contracts and modern web technologies.

## 🌟 Overview

TenderChain is a decentralized application (DApp) that revolutionizes the traditional tender management process by leveraging blockchain technology to ensure transparency, immutability, and fair bidding practices. The system facilitates the entire lifecycle from tender creation to contract completion and payment.

## 🏛️ System Architecture

### Core Entities
- **Government Officers** - Create and manage tenders, verify task completion
- **Contractors** - Submit bids on tenders, execute awarded contracts
- **Verifiers** - Verify proposals, documents, and user registrations
- **Contracts** - Manage post-award contract execution with task-based payments

### Smart Contract Structure
```
contracts/
├── Domain Contracts/
│   ├── Tender.sol              # Tender creation and bidding logic
│   ├── Contract.sol            # Contract execution and task management
│   ├── GovernmentOfficer.sol   # Officer profile and tender management
│   ├── Contractor.sol          # Contractor profile and bid management
│   └── Verifier.sol           # Verification and approval logic
├── Repository Contracts/
│   ├── TenderRepo.sol         # Tender registry and status tracking
│   ├── ContractRepo.sol       # Contract registry and lifecycle
│   ├── GovernmentOfficerRepo.sol # Officer registration and verification
│   └── ContractorRepo.sol     # Contractor registration and verification
└── Factory Contracts/
    ├── FactoryTender.sol      # Tender deployment factory
    ├── FactoryContract.sol    # Contract deployment factory
    ├── FactoryGovernmentOfficer.sol # Officer registration factory
    └── FactoryContractor.sol  # Contractor registration factory
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- MetaMask browser extension

### Automated Setup (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd tendersystem-blockchain

# Run automated setup
./setup.sh
```

The setup script will:
- Install dependencies
- Start Ganache CLI on port 8545
- Compile and deploy smart contracts
- Start frontend server on port 3000

### Manual Setup
```bash
# Install dependencies
npm install

# Start Ganache CLI
npx ganache --port 8545 --deterministic --accounts 10 &

# Compile contracts
npx truffle compile --config truffle.js

# Deploy contracts
npx truffle migrate --config truffle.js --reset

# Start frontend server
npm start
```

## 🌐 Access Points

Once running, access the application through:
- **Main Dashboard**: http://localhost:3000/dashboard.html
- **Registration Portal**: http://localhost:3000/register.html
- **Login Interface**: http://localhost:3000/login-new.html
- **Legacy Interface**: http://localhost:3000/

## 🔗 MetaMask Configuration

### Add Development Network
1. Open MetaMask
2. Click Networks dropdown → Add Network
3. Configure:
   - **Network Name**: TenderChain Development
   - **RPC URL**: http://localhost:8545
   - **Chain ID**: 1755516815265
   - **Currency Symbol**: ETH

### Import Development Accounts
Use these pre-funded accounts for testing:
```
Account 1: 0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1
Account 2: 0xffcf8fdee72ac11b5c542428b35eef5769c409f0
Account 3: 0x22d491bde2303f2f43325b2108d26f1eaba1e32b
```

## 📋 Features

### For Government Officers
- ✅ Create detailed tenders with multiple tasks
- ✅ Set bidding deadlines and requirements
- ✅ Review and evaluate contractor proposals
- ✅ Award contracts to selected contractors
- ✅ Monitor contract progress and verify task completion
- ✅ Authorize payments upon task verification

### For Contractors
- ✅ Browse available tenders
- ✅ Submit detailed bids with quotations
- ✅ Track bid status and notifications
- ✅ Execute awarded contracts
- ✅ Report task completion
- ✅ Withdraw payments for completed tasks

### For Verifiers
- ✅ Verify user registrations (officers and contractors)
- ✅ Review and approve proposal documents
- ✅ Ensure compliance with tender requirements
- ✅ Maintain verification records

## 🛠️ Development Commands

### Contract Development
```bash
# Compile contracts
npm run compile
# or
npx truffle compile --config truffle.js

# Deploy contracts
npm run migrate
# or
npx truffle migrate --config truffle.js --reset

# Interactive console
npm run dev
# or
npx truffle console --config truffle.js
```

### Testing
```bash
# Run contract tests
npx truffle test

# Run specific test file
npx truffle test test/specific-test.js

# Test with pattern matching
npx truffle test --grep "pattern"
```

## 📁 Project Structure

```
tendersystem-blockchain/
├── contracts/                 # Solidity smart contracts
├── migrations/               # Deployment scripts
├── web3/                     # Web3 integration files
│   ├── contracts.js          # Contract addresses and ABIs
│   └── web3-init.js         # Web3 initialization
├── test/                     # Contract tests (add your tests here)
├── build/                    # Compiled contract artifacts
├── dashboard.html           # Modern dashboard interface
├── register.html           # User registration
├── login-new.html          # Login interface
├── truffle.js              # Truffle config for port 8545
├── truffle-config.js       # Truffle config for port 7545
├── package.json            # Node.js dependencies
├── setup.sh                # Automated setup script
└── stop.sh                 # Stop all services
```

## 🔧 Configuration

### Network Configurations
- **truffle.js**: Development network at 127.0.0.1:8545 (CLI)
- **truffle-config.js**: Development network at 127.0.0.1:7545 (GUI)

Choose the appropriate config file:
```bash
# For Ganache CLI (port 8545)
npx truffle migrate --config truffle.js --reset

# For Ganache GUI (port 7545)  
npx truffle migrate --config truffle-config.js --reset
```

## 🚦 System Status

✅ **Contracts Deployed**: All smart contracts successfully deployed  
✅ **Web3 Integration**: Modern Web3 manager with MetaMask support  
✅ **Frontend Interface**: Responsive dashboard with Bootstrap UI  
✅ **Automated Setup**: One-command deployment script  
✅ **Documentation**: Comprehensive setup and usage guide  

## 🛡️ Security Features

- **Role-based Access Control**: Modifiers ensure only authorized users can perform actions
- **Verification System**: Multi-tier verification for users and proposals
- **Task-based Payments**: Funds released only after task verification
- **Immutable Records**: All transactions recorded on blockchain
- **Transparent Bidding**: Public bid visibility ensures fair competition

## 🐛 Troubleshooting

### Common Issues

1. **MetaMask Connection Issues**
   - Ensure MetaMask is connected to the correct network
   - Check that the Chain ID matches your Ganache instance

2. **Contract Deployment Failures**
   - Verify Ganache is running on the expected port
   - Use the correct Truffle config for your setup

3. **Port Conflicts**
   - Use `./stop.sh` to clean up existing processes
   - Check port availability with `lsof -ti:3000,8545`

### Debug Commands
```bash
# Check running processes
ps aux | grep -E "(ganache|serve|npm)"

# Check port usage
netstat -tulpn | grep -E ":3000|:8545"

# View logs
tail -f ganache.log
tail -f frontend.log
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the GPL-3.0 License.

---

**🎯 Ready to revolutionize tender management with blockchain technology!**
