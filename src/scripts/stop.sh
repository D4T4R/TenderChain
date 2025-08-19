#!/bin/bash

# TenderChain - Stop Script
echo "=== Stopping TenderChain Services ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Kill processes by pattern
print_status "Stopping Ganache and frontend processes..."
pkill -f "ganache\|truffle\|npm.*start\|serve.*3000" 2>/dev/null

# Kill processes on specific ports
print_status "Freeing ports 3000 and 8545..."
lsof -ti:3000,8545 2>/dev/null | xargs -r kill -9 2>/dev/null

# Wait a moment for processes to terminate
sleep 2

# Check if ports are free
if ! netstat -tulpn 2>/dev/null | grep -E ":3000|:8545" > /dev/null; then
    print_success "All services stopped successfully"
    print_success "Ports 3000 and 8545 are now free"
else
    echo -e "${YELLOW}[WARNING]${NC} Some services may still be running"
    echo "Check with: netstat -tulpn | grep -E ':3000|:8545'"
fi

echo ""
print_status "To restart the system, run: ./setup.sh"
echo ""
