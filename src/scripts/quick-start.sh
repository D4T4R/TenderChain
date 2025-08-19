#!/bin/bash

# Quick Start Script for Tender Management System
# This script automates the setup of Ganache + Truffle + Frontend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}"
    echo "======================================"
    echo "$1"
    echo "======================================"
    echo -e "${NC}"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js v14 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 14 ]; then
        print_error "Node.js version $NODE_VERSION is too old. Please install v14 or higher."
        exit 1
    fi
    
    print_message "Node.js $(node -v) detected ✓"
}

# Kill existing processes
cleanup() {
    print_warning "Cleaning up existing processes..."
    pkill -f ganache || true
    pkill -f "serve ." || true
    sleep 2
}

# Install dependencies
install_deps() {
    print_message "Installing dependencies..."
    npm install
}

# Start Ganache
start_ganache() {
    print_message "Starting Ganache CLI..."
    npm run ganache > ganache.log 2>&1 &
    GANACHE_PID=$!
    echo $GANACHE_PID > ganache.pid
    
    print_message "Ganache PID: $GANACHE_PID"
    print_message "Waiting for Ganache to start..."
    sleep 5
    
    # Check if Ganache is running
    if ! ps -p $GANACHE_PID > /dev/null; then
        print_error "Failed to start Ganache. Check ganache.log for details."
        cat ganache.log
        exit 1
    fi
    
    print_message "Ganache started successfully on http://127.0.0.1:8545"
}

# Compile and deploy contracts
deploy_contracts() {
    print_message "Compiling smart contracts..."
    npx truffle compile --config truffle.js
    
    print_message "Deploying contracts to Ganache..."
    npx truffle migrate --config truffle.js --reset
    
    if [ $? -eq 0 ]; then
        print_message "Contracts deployed successfully ✓"
    else
        print_error "Contract deployment failed!"
        exit 1
    fi
}

# Start frontend server
start_frontend() {
    print_message "Starting frontend server..."
    npm start > frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > frontend.pid
    
    print_message "Frontend PID: $FRONTEND_PID"
    print_message "Waiting for frontend server..."
    sleep 3
    
    # Check if frontend is running
    if ! ps -p $FRONTEND_PID > /dev/null; then
        print_error "Failed to start frontend. Check frontend.log for details."
        cat frontend.log
        exit 1
    fi
    
    print_message "Frontend server started on http://localhost:3000"
}

# Display Ganache account information
show_accounts() {
    print_header "GANACHE ACCOUNTS"
    print_message "Here are your development accounts:"
    echo
    echo "Account #0: 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1"
    echo "Private Key: 0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
    echo
    echo "Account #1: 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0"
    echo "Private Key: 0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1"
    echo
    echo "Account #2: 0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b"
    echo "Private Key: 0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c"
    echo
    echo "Account #3: 0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d"
    echo "Private Key: 0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913"
    echo
    print_warning "💡 Import these accounts into MetaMask using their private keys"
    print_warning "💡 Each account has 100 ETH for testing"
}

# Display setup instructions
show_instructions() {
    print_header "SETUP COMPLETE!"
    print_message "🎉 Your Tender Management System is ready!"
    echo
    print_message "📋 Next steps:"
    echo "1. Install MetaMask browser extension (https://metamask.io)"
    echo "2. Add custom network in MetaMask:"
    echo "   - Network Name: Ganache Development"
    echo "   - RPC URL: http://127.0.0.1:8545"
    echo "   - Chain ID: $(grep "network_id" ganache.log | head -1 | grep -o '[0-9]\+')"
    echo "   - Currency Symbol: ETH"
    echo "3. Import the accounts above into MetaMask"
    echo "4. Visit http://localhost:3000/register.html to register"
    echo "5. Visit http://localhost:3000/login-new.html to login"
    echo
    print_message "📁 Useful files:"
    echo "- ganache.log: Ganache blockchain logs"
    echo "- frontend.log: Frontend server logs"
    echo "- METAMASK_SETUP_GUIDE.md: Detailed setup guide"
    echo
    print_message "🛠️  Management commands:"
    echo "- Stop all: ./stop.sh"
    echo "- View logs: tail -f ganache.log"
    echo "- Reset blockchain: npm run ganache && npx truffle migrate --reset"
}

# Create stop script
create_stop_script() {
    cat > stop.sh << 'EOF'
#!/bin/bash
echo "Stopping Tender Management System..."

# Kill processes
if [ -f ganache.pid ]; then
    GANACHE_PID=$(cat ganache.pid)
    kill $GANACHE_PID 2>/dev/null || true
    rm ganache.pid
    echo "Ganache stopped"
fi

if [ -f frontend.pid ]; then
    FRONTEND_PID=$(cat frontend.pid)
    kill $FRONTEND_PID 2>/dev/null || true
    rm frontend.pid
    echo "Frontend server stopped"
fi

# Cleanup any remaining processes
pkill -f ganache || true
pkill -f "serve ." || true

echo "All processes stopped"
EOF
    chmod +x stop.sh
}

# Main execution
main() {
    print_header "TENDER MANAGEMENT SYSTEM - QUICK START"
    
    # Check prerequisites
    check_node
    
    # Cleanup existing processes
    cleanup
    
    # Install dependencies
    install_deps
    
    # Start Ganache
    start_ganache
    
    # Deploy contracts
    deploy_contracts
    
    # Start frontend
    start_frontend
    
    # Create stop script
    create_stop_script
    
    # Display information
    show_accounts
    show_instructions
    
    print_message "✅ Setup completed successfully!"
    print_warning "Keep this terminal open to maintain the services"
}

# Handle Ctrl+C gracefully
trap 'print_warning "Shutting down..."; cleanup; exit 0' SIGINT

# Run main function
main

# Keep script running
print_message "Press Ctrl+C to stop all services"
while true; do
    sleep 1
done
