#!/bin/bash

# TenderChain - Automated Setup Script
echo "=== TenderChain Automated Setup ==="
echo "Setting up the Decentralized Tender Management System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Check if npx is installed
if ! command -v npx &> /dev/null; then
    print_error "npx is not installed. Please install Node.js and npm first."
    exit 1
fi

# Step 1: Clean previous builds
print_status "Cleaning previous builds..."
rm -rf build/ node_modules/ *.log
print_success "Cleaned previous builds"

# Step 2: Install dependencies
print_status "Installing dependencies..."
if npm install > setup.log 2>&1; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies. Check setup.log for details."
    exit 1
fi

# Step 3: Kill existing processes
print_status "Stopping existing processes..."
pkill -f "ganache\|truffle\|npm.*start\|serve.*3000" 2>/dev/null || true
lsof -ti:3000,8545 2>/dev/null | xargs -r kill -9 2>/dev/null || true
print_success "Existing processes stopped"

# Step 4: Start Ganache CLI
print_status "Starting Ganache CLI on port 8545..."
npx ganache --port 8545 --deterministic --accounts 10 > ganache.log 2>&1 &
GANACHE_PID=$!

# Wait for Ganache to start
sleep 5

# Check if Ganache is running
if curl -s http://localhost:8545 -X POST -H "Content-Type: application/json" \
   --data '{"jsonrpc":"2.0","method":"eth_accounts","params":[],"id":1}' > /dev/null; then
    print_success "Ganache CLI started successfully on port 8545"
else
    print_error "Failed to start Ganache CLI"
    exit 1
fi

# Step 5: Compile contracts
print_status "Compiling smart contracts..."
if npx truffle compile --config truffle.js >> setup.log 2>&1; then
    print_success "Smart contracts compiled successfully"
else
    print_error "Failed to compile contracts. Check setup.log for details."
    exit 1
fi

# Step 6: Deploy contracts
print_status "Deploying smart contracts..."
if npx truffle migrate --config truffle.js --reset >> setup.log 2>&1; then
    print_success "Smart contracts deployed successfully"
else
    print_error "Failed to deploy contracts. Check setup.log for details."
    exit 1
fi

# Step 7: Start frontend server
print_status "Starting frontend server..."
npm start > frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

# Check if frontend is running
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    print_success "Frontend server started successfully on port 3000"
else
    print_error "Failed to start frontend server"
    exit 1
fi

# Display summary
echo ""
echo "=== Setup Complete! ==="
echo ""
print_success "✅ Ganache CLI running on http://localhost:8545"
print_success "✅ Smart contracts compiled and deployed"
print_success "✅ Frontend server running on http://localhost:3000"
echo ""
print_status "🎯 Available interfaces:"
echo "   • Main Dashboard: http://localhost:3000/dashboard.html"
echo "   • Registration: http://localhost:3000/register.html"
echo "   • Login: http://localhost:3000/login-new.html"
echo ""
print_status "🔧 Development accounts (use with MetaMask):"
echo "   • Account 1: 0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1"
echo "   • Account 2: 0xffcf8fdee72ac11b5c542428b35eef5769c409f0"
echo "   • Account 3: 0x22d491bde2303f2f43325b2108d26f1eaba1e32b"
echo ""
print_status "📋 Process Information:"
echo "   • Ganache PID: $GANACHE_PID"
echo "   • Frontend PID: $FRONTEND_PID"
echo ""
print_warning "⚠️  Remember to:"
echo "   1. Install MetaMask browser extension"
echo "   2. Add the development network (Chain ID: 1755516815265)"
echo "   3. Import development accounts using private keys"
echo ""
print_status "To stop all processes, run: ./stop.sh"
echo ""
