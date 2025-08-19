# MetaMask + Ganache Setup Guide for Tender Management System

This guide will walk you through setting up MetaMask with Ganache for the Decentralized Tender Management System, including registration and login for both Government Officers and Contractors/Bidders.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Install MetaMask](#install-metamask)
3. [Start Ganache](#start-ganache)
4. [Deploy Smart Contracts](#deploy-smart-contracts)
5. [Configure MetaMask](#configure-metamask)
6. [Start the Web Application](#start-the-web-application)
7. [Registration Process](#registration-process)
8. [Login Process](#login-process)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js (v14 or higher)
- Chrome, Firefox, or Edge browser
- Basic understanding of blockchain concepts

## Install MetaMask

1. **Install MetaMask Browser Extension:**
   - Go to [metamask.io](https://metamask.io)
   - Click "Download" and install the browser extension
   - Follow the setup wizard to create a new wallet or import existing one
   - **IMPORTANT:** Save your seed phrase securely

2. **Create a Development Wallet:**
   - For testing purposes, you can create a separate wallet
   - Write down the seed phrase (12 words)
   - Set a password you'll remember

## Start Ganache

1. **Install Dependencies:**
   ```bash
   cd /path/to/tendersystem-blockchain
   npm install
   ```

2. **Start Ganache CLI:**
   ```bash
   npm run ganache
   ```
   
   This starts Ganache on `http://127.0.0.1:8545` with:
   - 10 pre-funded accounts (each with 100 ETH)
   - Deterministic accounts (same addresses each time)
   - Network ID: varies (will be shown in console)

3. **Note the Account Addresses:**
   - Ganache will display 10 account addresses
   - Copy the first few addresses and their private keys
   - You'll use these for testing

## Deploy Smart Contracts

1. **Compile Contracts:**
   ```bash
   npm run compile
   ```

2. **Deploy to Ganache:**
   ```bash
   npx truffle migrate --config truffle.js --reset
   ```

3. **Note Contract Addresses:**
   - The migration will output deployed contract addresses
   - These are automatically configured in `web3/contracts.js`

## Configure MetaMask

### Add Development Network

1. **Open MetaMask** and click on the network dropdown (usually shows "Ethereum Mainnet")

2. **Add Custom RPC Network:**
   - Click "Add Network" or "Custom RPC"
   - Fill in the following details:
     ```
     Network Name: Ganache Development
     New RPC URL: http://127.0.0.1:8545
     Chain ID: [Check Ganache console output]
     Currency Symbol: ETH
     Block Explorer URL: (leave empty)
     ```

3. **Save the Network**

### Import Development Accounts

1. **Import Account from Private Key:**
   - Click on the account icon (top right)
   - Select "Import Account"
   - Select "Private Key"
   - Paste one of the private keys from Ganache
   - Give it a name like "Dev Account 1"

2. **Repeat for Multiple Accounts:**
   - Import 3-4 accounts for testing different roles
   - You'll use different accounts for officers and contractors

## Start the Web Application

1. **Start the Frontend Server:**
   ```bash
   npm start
   ```
   
   This serves the application on `http://localhost:3000`

2. **Open in Browser:**
   - Navigate to `http://localhost:3000`
   - You should see the application homepage

## Registration Process

### For Contractors/Bidders

1. **Navigate to Registration:**
   - Go to `http://localhost:3000/register.html`
   - Select "Contractor/Bidder" tab

2. **Connect MetaMask:**
   - Click "Connect MetaMask"
   - Select the development network if prompted
   - Choose one of your imported accounts
   - Authorize the connection

3. **Fill Registration Form:**
   ```
   Full Name: John Doe Contractors
   Email: john@contractors.com
   Phone: +1-555-0123
   PAN Number: ABCDE1234F (format: 5 letters + 4 digits + 1 letter)
   GST Number: 29ABCDE1234F1Z5
   ```

4. **Submit Registration:**
   - Click "Register Account"
   - MetaMask will prompt for transaction approval
   - Confirm the transaction (gas fees will be paid from your account)
   - Wait for transaction confirmation

5. **Success:**
   - You'll see a success message
   - The system will redirect to login page

### For Government Officers

1. **Use Different Account:**
   - Switch to a different MetaMask account
   - Go to `http://localhost:3000/register.html`
   - Select "Government Officer" tab

2. **Connect MetaMask:**
   - Click "Connect MetaMask" with the new account

3. **Fill Registration Form:**
   ```
   Full Name: Jane Smith
   Email: jane.smith@gov.in
   Phone: +1-555-0124
   Employee ID: GOV2024001
   ```

4. **Submit Registration:**
   - Follow the same process as contractor registration

## Login Process

### Step 1: Access Login Page
- Go to `http://localhost:3000/login-new.html`

### Step 2: Connect MetaMask
- Click "Connect MetaMask"
- Ensure you're connected to the Ganache Development network
- Select the account you registered with

### Step 3: Select User Type
- Choose either "Contractor/Bidder" or "Government Officer"
- The system will check your verification status

### Step 4: Verification Status
- **Newly registered users:** Will show "Pending Verification"
- **Verified users:** Will show "Verified ✓"
- Initially, all users are unverified and need admin approval

### Step 5: Login
- Click "Login to Dashboard"
- You'll be redirected based on your user type and verification status:
  - **Unverified users:** `dashboardNormal.html`
  - **Verified contractors:** `dashboardBiders.html` 
  - **Verified officers:** `dashboardGovernmentOfficer.html`

## Account Management

### Using Multiple Accounts for Testing

1. **Officer Account (Account #1):**
   - Register as Government Officer
   - Use for creating tenders and managing contracts

2. **Contractor Account #1 (Account #2):**
   - Register as Contractor
   - Use for bidding on tenders

3. **Contractor Account #2 (Account #3):**
   - Register as another Contractor
   - Create competitive bidding scenarios

4. **Verifier Account (Account #4):**
   - Can be used for verification processes

### Switching Between Accounts

1. **In MetaMask:**
   - Click on the account icon
   - Select different account from the dropdown
   - The web app will automatically detect the account change

2. **In the Web App:**
   - The app will show account change notifications
   - Some pages may reload to reflect the new account

## Verification Process (For Testing)

Since this is a development environment, you can manually verify accounts:

1. **Deploy Verifier Contract:**
   - Use the deployed Verifier contract address
   - Connect with a verifier account

2. **Verify Officers:**
   - Call `verifyGovernmentOfficer()` function
   - Pass the officer's contract address

3. **Verify Contractors:**
   - Call `verifyContractor()` function
   - Pass the contractor's contract address

## Troubleshooting

### MetaMask Issues

**Problem:** MetaMask not connecting
- **Solution:** 
  - Check if you're on the correct network (Ganache Development)
  - Refresh the page and try again
  - Make sure Ganache is running

**Problem:** Wrong network
- **Solution:**
  - Switch to the Ganache Development network
  - Check the Chain ID matches Ganache output

**Problem:** Insufficient funds
- **Solution:**
  - Make sure you're using an account from Ganache (they come pre-funded)
  - Check account balance in MetaMask

### Application Issues

**Problem:** Registration fails
- **Solution:**
  - Check browser console for errors
  - Ensure all form fields are filled correctly
  - Verify MetaMask is connected

**Problem:** Login redirects to wrong page
- **Solution:**
  - Check your user type selection
  - Clear browser localStorage: `localStorage.clear()`
  - Try logging in again

**Problem:** Contract interaction fails
- **Solution:**
  - Verify contracts are deployed correctly
  - Check contract addresses in `web3/contracts.js`
  - Restart Ganache and redeploy contracts

### Development Issues

**Problem:** Ganache port conflicts
- **Solution:**
  - Kill existing Ganache processes: `pkill -f ganache`
  - Use a different port: `ganache -p 8546`
  - Update `truffle.js` and MetaMask accordingly

**Problem:** Contract compilation errors
- **Solution:**
  - Check Solidity version compatibility (0.8.16)
  - Run `npm run compile` to see detailed errors
  - Fix contract syntax issues

## Advanced Configuration

### Custom Gas Settings

In MetaMask, you can customize gas settings for transactions:
- **Gas Limit:** Usually 3000000 is sufficient
- **Gas Price:** Use default for development
- **Max Fee:** Adjust if transactions are slow

### Network Persistence

To keep the same network ID across Ganache restarts:
```bash
npx ganache -p 8545 --deterministic --networkId 1337 --accounts 10
```

### Account Import Script

You can create a script to automatically import multiple accounts:
```javascript
// Import this in browser console
const privateKeys = [
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
  "0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1",
  // ... more keys from Ganache
];
```

## Security Notes

⚠️ **Important Security Reminders:**

1. **Never use development keys in production**
2. **Never share private keys or seed phrases**
3. **This setup is for development only**
4. **Use different accounts for different roles**
5. **Keep your MetaMask seed phrase secure**

## Next Steps

After successful setup:
1. Test the complete user flow (registration → login → dashboard)
2. Create tenders as a Government Officer
3. Place bids as Contractors
4. Test the verification workflow
5. Explore contract management features

For production deployment, you'll need to:
- Deploy to a testnet (Ropsten, Rinkeby, or Polygon Mumbai)
- Implement proper user verification workflows
- Add security measures and access controls
- Set up proper backend infrastructure

## Support

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check Ganache console for blockchain errors
3. Verify MetaMask is properly configured
4. Ensure all contracts are deployed successfully

Common commands for debugging:
```bash
# Check if Ganache is running
netstat -tulpn | grep :8545

# Restart the entire development environment
pkill -f ganache
npm run ganache &
sleep 3
npx truffle migrate --config truffle.js --reset
npm start
```
