// Smart Contract Addresses - Enhanced TenderChain System Deployment
window.CONTRACT_ADDRESSES = {
    // Repository contracts
    GovernmentOfficerRepo: "0x22d5C8BdD4346b390014a07109a8F830094d4abf",
    TenderRepo: "0x7414e38377D6DAf6045626EC8a8ABB8a1BC4B97a",
    ContractRepo: "0xB9bdBAEc07751F6d54d19A6B9995708873F3DE18",
    ContractorRepo: "0x4bf3A7dFB3b76b5B3E169ACE65f888A4b4FCa5Ee",
    VerifierRepo: "0x4cFB3F70BF6a80397C2e634e5bDd85BC0bb189EE", // Using Verifier address as fallback
    
    // Base contracts
    Contract: "0xFcCeD5E997E7fb1D0594518D3eD57245bB8ed17E",
    Contractor: "0x4339316e04CFfB5961D1c41fEF8E44bfA2A7fBd1",
    GovernmentOfficer: "0xdAA71FBBA28C946258DD3d5FcC9001401f72270F",
    Tender: "0xf19A2A01B70519f67ADb309a994Ec8c69A967E8b",
    Verifier: "0x4cFB3F70BF6a80397C2e634e5bDd85BC0bb189EE",
    
    // Factory contracts
    FactoryContractor: "0xCeeFD27e0542aFA926B87d23936c79c276A48277",
    FactoryGovernmentOfficer: "0x47a2Db5D68751EeAdFBC44851E84AcDB4F7299Cc",
    FactoryContract: "0x988B6CFBf3332FF98FFBdED665b1F53a61f92612",
    FactoryTender: "0xeea2Fc1D255Fd28aA15c6c2324Ad40B03267f9c5",
    FactoryVerifier: "0x8914a9E5C5E234fDC3Ce9dc155ec19F43947ab59",
    
    // Enhanced system contracts
    StakeManager: "0xe97DbD7116D168190F8A6E7beB1092c103c53a12",
    PublicClaims: "0xF16165f1046f1B3cDB37dA25E835B986E696313A",
    PublicDashboard: "0xD13ebb5C39fB00C06122827E1cbD389930C9E0E3"
};

// Network configuration
const NETWORK_CONFIG = {
    chainId: 1755516815265, // Ganache chain ID (from deployment)
    rpcUrl: "http://127.0.0.1:8545",
    networkName: "Development"
};

// Smart Contract ABIs - Available globally
window.FactoryContractAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "govtOfficerAddress",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "_contractorAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_contractName",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_tenderId",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "_completionTime",
                "type": "uint256"
            },
            {
                "internalType": "string[]",
                "name": "_constraints",
                "type": "string[]"
            },
            {
                "internalType": "uint256",
                "name": "_finalQuotationAmount",
                "type": "uint256"
            },
            {
                "internalType": "string[]",
                "name": "_taskDescription",
                "type": "string[]"
            },
            {
                "internalType": "uint256[]",
                "name": "_deadlineForEachTask",
                "type": "uint256[]"
            },
            {
                "internalType": "uint256[]",
                "name": "_amountForEachTask",
                "type": "uint256[]"
            }
        ],
        "name": "createContract",
        "outputs": [
            {
                "internalType": "contract Contract",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    }
];

window.ContractorRepoAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "contractorAddress",
                "type": "address"
            }
        ],
        "name": "getContractor",
        "outputs": [
            {
                "internalType": "address",
                "name": "walletAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "email",
                "type": "string"
            },
            {
                "internalType": "bool",
                "name": "isVerified",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "contractorAddress",
                "type": "address"
            }
        ],
        "name": "getVerificationStatus",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getContractors",
        "outputs": [
            {
                "internalType": "address[]",
                "name": "",
                "type": "address[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "walletAddress",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "nodeAddress",
                "type": "address"
            }
        ],
        "name": "newContractor",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

window.GovernmentOfficerRepoAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "officerAddress",
                "type": "address"
            }
        ],
        "name": "getGovernmentOfficer",
        "outputs": [
            {
                "internalType": "address",
                "name": "walletAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "email",
                "type": "string"
            },
            {
                "internalType": "bool",
                "name": "isVerified",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "walletAddress",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "nodeAddress",
                "type": "address"
            }
        ],
        "name": "newOfficer",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "officerAddress",
                "type": "address"
            }
        ],
        "name": "getVerifiedStatus",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getGovernmentOfficers",
        "outputs": [
            {
                "internalType": "address[]",
                "name": "",
                "type": "address[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];


window.ContractRepoAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "contractToAppend",
                "type": "address"
            }
        ],
        "name": "addToContracts",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

window.ContractorAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_walletAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_email",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_phoneNumber",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_panNumber",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_gstNumber",
                "type": "string"
            }
        ],
        "name": "setContractor",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

window.GovernmentOfficerAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_walletAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_email",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_phoneNumber",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_employeeId",
                "type": "string"
            }
        ],
        "name": "setGovernmentOfficer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Factory contract ABIs for user registration
window.FactoryContractorAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_walletAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_email",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_phoneNumber",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_panNumber",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_gstNumber",
                "type": "string"
            }
        ],
        "name": "registerNewContractor",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

window.FactoryGovernmentOfficerAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_walletAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_email",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_phoneNumber",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_employeeId",
                "type": "string"
            }
        ],
        "name": "registerOfficer",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// FactoryTender ABI for creating tenders
window.FactoryTenderAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_governmentOfficerAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_tenderName",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_tenderId",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "_bidSubmissionClosingDate",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_bidOpeningDate",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_covers",
                "type": "uint256"
            },
            {
                "internalType": "string[]",
                "name": "_clauses",
                "type": "string[]"
            },
            {
                "internalType": "string[]",
                "name": "_taskName",
                "type": "string[]"
            },
            {
                "internalType": "uint256[]",
                "name": "_taskDays",
                "type": "uint256[]"
            },
            {
                "internalType": "string[]",
                "name": "_constraints",
                "type": "string[]"
            }
        ],
        "name": "createTender",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAllTenders",
        "outputs": [
            {
                "internalType": "address[]",
                "name": "",
                "type": "address[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTenderCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "index",
                "type": "uint256"
            }
        ],
        "name": "getTenderAt",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// TenderRepo ABI for fetching tenders
window.TenderRepoAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "tenderToAppend",
                "type": "address"
            }
        ],
        "name": "newTender",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAllTenders",
        "outputs": [
            {
                "internalType": "address[]",
                "name": "",
                "type": "address[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTenderCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "tenderAddress",
                "type": "address"
            }
        ],
        "name": "getTenderStatus",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// Tender ABI for individual tender details
window.TenderAbi = [
    {
        "inputs": [],
        "name": "getTenderBasic",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTenderAdvanced",
        "outputs": [
            {
                "internalType": "string[]",
                "name": "",
                "type": "string[]"
            },
            {
                "internalType": "string[]",
                "name": "",
                "type": "string[]"
            },
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            },
            {
                "internalType": "string[]",
                "name": "",
                "type": "string[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getProposalCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// StakeManager ABI for staking functionality
window.StakeManagerAbi = [
    {
        "inputs": [
            {
                "internalType": "enum StakeManager.StakeType",
                "name": "_stakeType",
                "type": "uint8"
            },
            {
                "internalType": "address",
                "name": "_targetContract",
                "type": "address"
            }
        ],
        "name": "createStake",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_stakeId",
                "type": "uint256"
            }
        ],
        "name": "releaseStake",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_stakeId",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "_reason",
                "type": "string"
            }
        ],
        "name": "slashStake",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// PublicClaims ABI for transparency and corruption reporting
window.PublicClaimsAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_targetContract",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_description",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_evidence",
                "type": "string"
            }
        ],
        "name": "createClaim",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_claimId",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "_inFavor",
                "type": "bool"
            }
        ],
        "name": "voteOnClaim",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAllClaims",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// FactoryVerifier ABI for verifier management
window.FactoryVerifierAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_walletAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_email",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_specialization",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_credentials",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "_stakeManagerAddress",
                "type": "address"
            }
        ],
        "name": "createVerifier",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    }
];

// Verifier ABI for milestone verification
window.VerifierAbi = [
    {
        "inputs": [],
        "name": "getVerifierInfo",
        "outputs": [
            {
                "internalType": "address",
                "name": "walletAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "email",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "specialization",
                "type": "string"
            },
            {
                "internalType": "bool",
                "name": "isActive",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// VerifierRepo ABI for verifier repository management
window.VerifierRepoAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "verifierAddress",
                "type": "address"
            }
        ],
        "name": "getVerifier",
        "outputs": [
            {
                "internalType": "address",
                "name": "walletAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "email",
                "type": "string"
            },
            {
                "internalType": "bool",
                "name": "isActive",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "verifierToAppend",
                "type": "address"
            }
        ],
        "name": "addToVerifiers",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAllVerifiers",
        "outputs": [
            {
                "internalType": "address[]",
                "name": "",
                "type": "address[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// PublicDashboard ABI for public transparency
window.PublicDashboardAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_contractAddress",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_comment",
                "type": "string"
            }
        ],
        "name": "addComment",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_contractAddress",
                "type": "address"
            }
        ],
        "name": "getComments",
        "outputs": [
            {
                "internalType": "string[]",
                "name": "",
                "type": "string[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// Make all contracts globally available
if (typeof window !== 'undefined') {
    window.CONTRACT_ADDRESSES = window.CONTRACT_ADDRESSES;
    window.NETWORK_CONFIG = NETWORK_CONFIG;
}
