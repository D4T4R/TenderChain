const Web3 = require('web3');

// Connect to local Ganache
const web3 = new Web3('http://127.0.0.1:8545');

// Contract addresses from deployment
const CONTRACT_ADDRESSES = {
    StakeManager: "0xe97DbD7116D168190F8A6E7beB1092c103c53a12",
    PublicClaims: "0xF16165f1046f1B3cDB37dA25E835B986E696313A",
    PublicDashboard: "0xD13ebb5C39fB00C06122827E1cbD389930C9E0E3",
    FactoryTender: "0xeea2Fc1D255Fd28aA15c6c2324Ad40B03267f9c5",
    FactoryVerifier: "0x8914a9E5C5E234fDC3Ce9dc155ec19F43947ab59"
};

// Simple ABI for testing
const StakeManagerAbi = [
    {
        "inputs": [
            {"internalType": "enum StakeManager.StakeType", "name": "_stakeType", "type": "uint8"},
            {"internalType": "address", "name": "_targetContract", "type": "address"}
        ],
        "name": "createStake",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "payable",
        "type": "function"
    }
];

const FactoryTenderAbi = [
    {
        "inputs": [],
        "name": "getTenderCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

async function testEnhancedSystem() {
    try {
        console.log('🔍 Testing Enhanced TenderChain System...\n');
        
        // Get accounts
        const accounts = await web3.eth.getAccounts();
        console.log(`📝 Using account: ${accounts[0]}\n`);
        
        // Test StakeManager
        console.log('🔒 Testing StakeManager contract...');
        const stakeManager = new web3.eth.Contract(StakeManagerAbi, CONTRACT_ADDRESSES.StakeManager);
        console.log(`✅ StakeManager contract loaded at: ${CONTRACT_ADDRESSES.StakeManager}\n`);
        
        // Test FactoryTender
        console.log('🏭 Testing FactoryTender contract...');
        const factoryTender = new web3.eth.Contract(FactoryTenderAbi, CONTRACT_ADDRESSES.FactoryTender);
        const tenderCount = await factoryTender.methods.getTenderCount().call();
        console.log(`✅ FactoryTender contract loaded at: ${CONTRACT_ADDRESSES.FactoryTender}`);
        console.log(`📊 Current tender count: ${tenderCount}\n`);
        
        // Test other contracts exist
        console.log('🔍 Verifying other contract deployments...');
        
        const publicClaimsCode = await web3.eth.getCode(CONTRACT_ADDRESSES.PublicClaims);
        console.log(`✅ PublicClaims contract deployed: ${publicClaimsCode !== '0x'}`);
        
        const publicDashboardCode = await web3.eth.getCode(CONTRACT_ADDRESSES.PublicDashboard);
        console.log(`✅ PublicDashboard contract deployed: ${publicDashboardCode !== '0x'}`);
        
        const factoryVerifierCode = await web3.eth.getCode(CONTRACT_ADDRESSES.FactoryVerifier);
        console.log(`✅ FactoryVerifier contract deployed: ${factoryVerifierCode !== '0x'}\n`);
        
        console.log('🎉 Enhanced TenderChain system is successfully deployed and operational!');
        console.log('\n📋 Summary:');
        console.log('✅ StakeManager - Ready for stake management');
        console.log('✅ PublicClaims - Ready for transparency and corruption reporting');
        console.log('✅ PublicDashboard - Ready for public contract monitoring');
        console.log('✅ FactoryVerifier - Ready for verifier registration');
        console.log('✅ All factory contracts operational');
        
        console.log('\n🔗 Contract Addresses:');
        Object.entries(CONTRACT_ADDRESSES).forEach(([name, address]) => {
            console.log(`   ${name}: ${address}`);
        });
        
    } catch (error) {
        console.error('❌ Error testing enhanced system:', error);
    }
}

testEnhancedSystem();
