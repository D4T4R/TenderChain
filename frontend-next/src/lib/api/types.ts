export type UserType =
  | "contractor"
  | "government_officer"
  | "verifier"
  // General-population verifier: bonded rather than authorised, participates in
  // the stake-gated public claims flow.
  | "public_verifier"
  | "admin";

/**
 * A wallet the account has proven control of.
 *
 * An account may have none: identity is decoupled from the wallet, and only
 * on-chain actions require one.
 */
export interface LinkedWallet {
  address: string;
  isPrimary: boolean;
  label?: string;
  provenAt?: string;
}

export interface AuthUser {
  _id: string;
  userType: UserType;
  email: string;
  phoneNumber: string;
  fullName: string;
  isActive: boolean;
  kycStatus: "pending" | "under_review" | "approved" | "rejected";
  verificationStatus: "unverified" | "verified" | "suspended";
  profileCompleteness?: number;
  profileUrl?: string;
  lastLogin?: string;
  createdAt?: string;
}

/** Fields the backend requires on a first-ever sign-in. */
export interface SignUpProfile {
  email: string;
  phoneNumber: string;
  fullName: string;
  userType?: UserType;
}

export interface RegisterPayload extends SignUpProfile {
  password: string;
}

export interface NonceResponse {
  success: boolean;
  nonce: string;
  domain: string;
  uri: string;
  chainId: number;
  statement: string;
  expiresAt: string;
}

/** Capability tiers, mirroring backend/services/sessionService.js. */
export type Capability = "read" | "write:offchain" | "write:onchain";

export interface SessionInfo {
  sid: string;
  method: "password" | "wallet";
  role: UserType;
  capabilities: Capability[];
  walletAddress: string | null;
  createdAt: number;
  lastSeenAt: number;
}

export interface StepUpResponse {
  success: boolean;
  accessToken: string;
  expiresIn: string;
  walletAddress: string;
  capabilities: Capability[];
  /** Seconds until the on-chain capability decays and must be re-proven. */
  expiresInSeconds: number;
}

export interface AuthResponse {
  success: boolean;
  created?: boolean;
  user: AuthUser;
  wallets?: LinkedWallet[];
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  /** The wallet bound to this session, if any. Null for a password sign-in. */
  walletAddress?: string | null;
  /** Session id, so the client can correlate with the session endpoints. */
  sid?: string;
  capabilities?: Capability[];
}
