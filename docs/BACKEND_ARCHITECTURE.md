# TenderChain Backend Architecture

## Database Design (MongoDB)

### 1. Users Collection
```javascript
{
  _id: ObjectId,
  walletAddress: String, // Primary key linking to blockchain
  userType: String, // 'contractor' | 'government_officer' | 'verifier' | 'admin'
  email: String,
  phoneNumber: String,
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean,
  kycStatus: String, // 'pending' | 'approved' | 'rejected'
  verificationStatus: String, // 'unverified' | 'verified' | 'suspended'
}
```

### 2. Contractors Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Reference to Users collection
  walletAddress: String,
  companyName: String,
  fullName: String,
  panNumber: String,
  gstNumber: String,
  registrationNumber: String,
  incorporationDate: Date,
  companyType: String, // 'private' | 'public' | 'partnership' | 'llp'
  businessCategory: [String], // e.g., ['construction', 'it', 'consulting']
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    accountHolderName: String
  },
  documents: {
    panCard: String, // IPFS hash
    gstCertificate: String, // IPFS hash
    incorporationCertificate: String, // IPFS hash
    bankStatement: String, // IPFS hash
    experience: [String], // Array of IPFS hashes
    certifications: [String] // Array of IPFS hashes
  },
  financialInfo: {
    annualTurnover: Number,
    creditRating: String,
    taxStatus: String
  },
  experience: {
    yearsInBusiness: Number,
    previousProjects: Number,
    completedValue: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 3. Government Officers Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  walletAddress: String,
  fullName: String,
  employeeId: String,
  department: String,
  designation: String,
  officeAddress: {
    building: String,
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  permissions: [String], // ['create_tender', 'approve_bids', 'manage_contracts']
  reportingOfficer: ObjectId, // Reference to another government officer
  documents: {
    employeeIdCard: String, // IPFS hash
    appointmentLetter: String, // IPFS hash
    authorizationLetter: String // IPFS hash
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 4. Verifiers Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  walletAddress: String,
  fullName: String,
  qualification: String,
  experience: Number, // years of experience
  specialization: [String], // ['civil', 'electrical', 'mechanical', 'environmental']
  licenseNumber: String,
  issuingAuthority: String,
  licenseValidTill: Date,
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  documents: {
    qualificationCertificate: String, // IPFS hash
    experienceCertificate: String, // IPFS hash
    professionalLicense: String, // IPFS hash
    identityProof: String // IPFS hash
  },
  verificationStats: {
    totalVerifications: Number,
    successfulVerifications: Number,
    averageRating: Number,
    stakingHistory: [{
      amount: Number,
      date: Date,
      type: String // 'stake' | 'reward' | 'penalty'
    }]
  },
  availability: {
    isAvailable: Boolean,
    maxConcurrentVerifications: Number,
    currentAssignments: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 5. Tenders Collection (Metadata)
```javascript
{
  _id: ObjectId,
  tenderAddress: String, // Blockchain contract address
  createdBy: ObjectId, // Government officer
  tenderName: String,
  tenderId: String,
  description: String,
  category: String,
  estimatedValue: Number,
  documents: {
    tenderDocument: String, // IPFS hash
    technicalSpecs: String, // IPFS hash
    terms: String, // IPFS hash
    drawings: [String] // Array of IPFS hashes
  },
  location: {
    state: String,
    district: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  eligibilityCriteria: {
    minTurnover: Number,
    minExperience: Number,
    requiredCertifications: [String]
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 6. Bids Collection (Metadata)
```javascript
{
  _id: ObjectId,
  tenderAddress: String,
  bidderAddress: String,
  bidAmount: Number,
  description: String,
  documents: {
    technicalProposal: String, // IPFS hash
    financialProposal: String, // IPFS hash
    compliance: String, // IPFS hash
    experience: [String] // Array of IPFS hashes
  },
  status: String, // 'submitted' | 'evaluated' | 'accepted' | 'rejected'
  submittedAt: Date,
  evaluatedAt: Date,
  evaluationComments: String
}
```

### 7. Verification Assignments
```javascript
{
  _id: ObjectId,
  contractAddress: String,
  verifierAddress: String,
  milestoneIndex: Number,
  assignedAt: Date,
  status: String, // 'assigned' | 'in_progress' | 'completed' | 'disputed'
  stakeAmount: Number,
  documents: {
    submittedProofs: [String], // IPFS hashes from contractor
    verificationProofs: [String], // IPFS hashes from verifier
    verificationReport: String // IPFS hash
  },
  verificationResult: String, // 'approved' | 'rejected' | 'partial'
  comments: String,
  completedAt: Date
}
```

### 8. Document Storage
```javascript
{
  _id: ObjectId,
  ipfsHash: String,
  fileName: String,
  fileSize: Number,
  mimeType: String,
  uploadedBy: String, // wallet address
  uploadedAt: Date,
  documentType: String, // 'kyc' | 'tender' | 'bid' | 'verification' | 'other'
  accessLevel: String, // 'public' | 'restricted' | 'private'
  metadata: {
    description: String,
    tags: [String],
    relatedEntity: String // tender ID, contract address, etc.
  }
}
```

## API Endpoints Structure

### Authentication & User Management
- POST /api/auth/register
- POST /api/auth/verify-wallet
- GET /api/user/profile
- PUT /api/user/profile
- POST /api/user/kyc-documents

### Contractor Endpoints
- GET /api/contractors/profile
- PUT /api/contractors/profile
- POST /api/contractors/documents
- GET /api/contractors/tenders
- POST /api/contractors/bid

### Government Officer Endpoints
- GET /api/officers/profile
- PUT /api/officers/profile
- POST /api/officers/tenders
- GET /api/officers/bids
- POST /api/officers/evaluate-bid

### Verifier Endpoints
- GET /api/verifiers/profile
- PUT /api/verifiers/profile
- GET /api/verifiers/assignments
- POST /api/verifiers/submit-verification
- GET /api/verifiers/stake-history

### File Management
- POST /api/files/upload
- GET /api/files/:ipfsHash
- DELETE /api/files/:ipfsHash
- GET /api/files/metadata/:ipfsHash

### Public Endpoints
- GET /api/public/tenders
- GET /api/public/contracts
- GET /api/public/verifications
- GET /api/public/statistics

## Technology Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **IPFS** (js-ipfs or ipfs-http-client)
- **Web3.js** for blockchain integration
- **Multer** for file uploads
- **JWT** for authentication
- **Joi** for validation

### Additional Services
- **Redis** for caching and sessions
- **Bull Queue** for background jobs
- **Winston** for logging
- **Docker** for containerization

## Security Considerations

1. **Wallet-based Authentication**
2. **Document Encryption** before IPFS storage
3. **Access Control** based on user roles
4. **Input Validation** and sanitization
5. **Rate Limiting** for API endpoints
6. **Audit Logging** for all operations
