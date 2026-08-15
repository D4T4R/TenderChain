export type UserType =
  | "contractor"
  | "government_officer"
  | "verifier"
  | "admin";

export interface AuthUser {
  _id: string;
  walletAddress: string;
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

export interface NonceResponse {
  success: boolean;
  nonce: string;
  domain: string;
  uri: string;
  chainId: number;
  statement: string;
  expiresAt: string;
}

export interface AuthResponse {
  success: boolean;
  created?: boolean;
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}
