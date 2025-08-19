/**
 * Web3 Initialization Script for Tender Management System
 * Provides MetaMask integration and contract interaction utilities
 */

// Import contract addresses and configurations
const { CONTRACT_ADDRESSES, NETWORK_CONFIG } = (() => {
    try {
        // Try to import from contracts.js if available
        if (typeof CONTRACT_ADDRESSES !== 'undefined') {
            return { CONTRACT_ADDRESSES, NETWORK_CONFIG };
        }
    } catch (e) {
        console.warn('contracts.js not available, using fallback addresses');
    }
    
    // Fallback addresses
    return {
        CONTRACT_ADDRESSES: {
            GovernmentOfficerRepo: "0xCfEB869F69431e42cdB54A4F4f105C19C080A601",
            TenderRepo: "0x254dffcd3277C0b1660F6d42EFbB754edaBAbC2B",
            ContractRepo: "0xC89Ce4735882C9F0f0FE26686c53074E09B0D550",
            ContractorRepo: "0xD833215cBcc3f914bD1C9ece3EE7BF8B14f841bb",
            Contract: "0x9561C133DD8580860B6b7E504bC5Aa500f0f06a7",
            Contractor: "0xe982E462b094850F12AF94d21D470e21bE9D0E9C",
            GovernmentOfficer: "0x59d3631c86BbE35EF041872d502F218A39FBa150",
            Tender: "0x0290FB167208Af455bB137780163b7B7a9a10C16",
            Verifier: "0x9b1f7F645351AF3631a656421eD2e40f2802E6c0"
        },
        NETWORK_CONFIG: {
            chainId: 1755516815265,
            rpcUrl: "http://127.0.0.1:8545",
            networkName: "Development"
        }
    };
})();

class Web3Manager {
    constructor() {
        this.web3 = null;
        this.account = null;
        this.contracts = {};
        this.isInitialized = false;
    }

    /**
     * Initialize Web3 and connect to MetaMask
     */
    async init() {
        try {
            // Check if MetaMask is installed
            if (typeof window.ethereum !== 'undefined') {
                console.log('MetaMask detected');
                this.web3 = new Web3(window.ethereum);
                
                // Request account access
                await this.connectMetaMask();
                
                // Setup network
                await this.setupNetwork();
                
                // Initialize contracts
                this.initContracts();
                
                // Setup event listeners
                this.setupEventListeners();
                
                this.isInitialized = true;
                console.log('Web3 initialized successfully');
                
                return true;
            } else {
                console.error('MetaMask not detected');
                alert('Please install MetaMask to use this application');
                return false;
            }
        } catch (error) {
            console.error('Failed to initialize Web3:', error);
            return false;
        }
    }

    /**
     * Connect to MetaMask
     */
    async connectMetaMask() {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.account = accounts[0];
            console.log('Connected to MetaMask:', this.account);
            return this.account;
        } catch (error) {
            console.error('Failed to connect to MetaMask:', error);
            throw error;
        }
    }

    /**
     * Setup development network
     */
    async setupNetwork() {
        try {
            // Check current network
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            console.log('Current chain ID:', parseInt(chainId, 16));
            
            // If not on development network, try to switch or add it
            if (parseInt(chainId, 16) !== NETWORK_CONFIG.chainId) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}` }]
                    });
                } catch (switchError) {
                    // Network doesn't exist, add it
                    if (switchError.code === 4902) {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}`,
                                chainName: NETWORK_CONFIG.networkName,
                                rpcUrls: [NETWORK_CONFIG.rpcUrl],
                                nativeCurrency: {
                                    name: 'ETH',
                                    symbol: 'ETH',
                                    decimals: 18
                                }
                            }]
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Failed to setup network:', error);
        }
    }

    /**
     * Initialize smart contracts
     */
    initContracts() {
        try {
            // Initialize contracts with ABIs
            this.contracts.governmentOfficerRepo = new this.web3.eth.Contract(
                GovernmentOfficerRepoAbi, 
                CONTRACT_ADDRESSES.GovernmentOfficerRepo
            );
            
            this.contracts.contractorRepo = new this.web3.eth.Contract(
                ContractorRepoAbi,
                CONTRACT_ADDRESSES.ContractorRepo
            );
            
            this.contracts.tenderRepo = new this.web3.eth.Contract(
                TenderRepoAbi,
                CONTRACT_ADDRESSES.TenderRepo
            );
            
            this.contracts.contractRepo = new this.web3.eth.Contract(
                ContractRepoAbi,
                CONTRACT_ADDRESSES.ContractRepo
            );

            console.log('Contracts initialized');
        } catch (error) {
            console.error('Failed to initialize contracts:', error);
        }
    }

    /**
     * Setup MetaMask event listeners
     */
    setupEventListeners() {
        // Account change listener
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                console.log('MetaMask disconnected');
                this.account = null;
            } else {
                console.log('Account changed:', accounts[0]);
                this.account = accounts[0];
                this.onAccountChanged(accounts[0]);
            }
        });

        // Network change listener
        window.ethereum.on('chainChanged', (chainId) => {
            console.log('Network changed:', parseInt(chainId, 16));
            window.location.reload(); // Reload page on network change
        });
    }

    /**
     * Account changed callback
     */
    onAccountChanged(newAccount) {
        // Update UI or perform account-specific actions
        console.log('Account updated:', newAccount);
        
        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('accountChanged', { 
            detail: { account: newAccount }
        }));
    }

    /**
     * Create a new contractor
     */
    async registerContractor(contractorData) {
        try {
            const { email, name, phoneNumber, panNumber, gstNumber } = contractorData;
            
            // Create new contractor contract
            const contractorContract = new this.web3.eth.Contract(ContractorAbi);
            
            const newContractor = await contractorContract.deploy({
                data: '0x' // Bytecode would be here in real deployment
            }).send({
                from: this.account,
                gas: 3000000
            });

            // Set contractor details
            await newContractor.methods.setContractor(
                this.account,
                email,
                name,
                phoneNumber,
                panNumber,
                gstNumber
            ).send({
                from: this.account,
                gas: 500000
            });

            // Register in repository
            await this.contracts.contractorRepo.methods.newContractor(
                this.account,
                newContractor.options.address
            ).send({
                from: this.account,
                gas: 200000
            });

            console.log('Contractor registered:', newContractor.options.address);
            return newContractor.options.address;
            
        } catch (error) {
            console.error('Failed to register contractor:', error);
            throw error;
        }
    }

    /**
     * Create a new government officer
     */
    async registerGovernmentOfficer(officerData) {
        try {
            const { email, name, phoneNumber, employeeId } = officerData;
            
            // Create new government officer contract
            const officerContract = new this.web3.eth.Contract(GovernmentOfficerAbi);
            
            const newOfficer = await officerContract.deploy({
                data: '0x' // Bytecode would be here in real deployment
            }).send({
                from: this.account,
                gas: 3000000
            });

            // Set officer details
            await newOfficer.methods.setGovernmentOfficer(
                this.account,
                email,
                name,
                phoneNumber,
                employeeId
            ).send({
                from: this.account,
                gas: 500000
            });

            // Register in repository
            await this.contracts.governmentOfficerRepo.methods.newOfficer(
                this.account,
                newOfficer.options.address
            ).send({
                from: this.account,
                gas: 200000
            });

            console.log('Government Officer registered:', newOfficer.options.address);
            return newOfficer.options.address;
            
        } catch (error) {
            console.error('Failed to register government officer:', error);
            throw error;
        }
    }

    /**
     * Get current account
     */
    getCurrentAccount() {
        return this.account;
    }

    /**
     * Check if user is verified
     */
    async checkVerificationStatus(userType = 'contractor') {
        try {
            if (userType === 'contractor') {
                return await this.contracts.contractorRepo.methods
                    .getVerificationStatus(this.account)
                    .call();
            } else if (userType === 'officer') {
                return await this.contracts.governmentOfficerRepo.methods
                    .getVerifiedStatus(this.account)
                    .call();
            }
        } catch (error) {
            console.error('Failed to check verification status:', error);
            return false;
        }
    }

    /**
     * Utility function to convert Wei to Ether
     */
    weiToEther(wei) {
        return this.web3.utils.fromWei(wei, 'ether');
    }

    /**
     * Utility function to convert Ether to Wei
     */
    etherToWei(ether) {
        return this.web3.utils.toWei(ether, 'ether');
    }
}

// Global Web3 Manager instance
window.web3Manager = new Web3Manager();

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Web3...');
    await window.web3Manager.init();
});
