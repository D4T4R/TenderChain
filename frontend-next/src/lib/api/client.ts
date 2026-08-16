/**
 * Thin client for the Express backend.
 *
 * Note: the tender/contractor/officer/verifier/public routes are still
 * health-check stubs on the backend. Only /api/auth, /api/user and /api/files
 * are implemented, so those are the only ones typed here.
 */

import { tokenStore } from "@/lib/auth/tokenStore";
import type {
  AuthResponse,
  AuthUser,
  Capability,
  NonceResponse,
  RegisterPayload,
  SessionInfo,
  SignUpProfile,
  StepUpResponse,
} from "./types";

export type {
  AuthResponse,
  AuthUser,
  Capability,
  LinkedWallet,
  NonceResponse,
  RegisterPayload,
  SessionInfo,
  SignUpProfile,
  StepUpResponse,
  UserType,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Structured refusal reasons the backend attaches to a 403.
 *
 * These matter because the remedy differs: a missing wallet is fixed by the
 * user signing, a missing on-chain role is fixed by an administrator. A client
 * that cannot tell them apart cannot prompt correctly.
 */
export interface RefusalDetail {
  reason?:
    | "wallet_required"
    | "wallet_proof_stale"
    | "capability_required"
    | "role_not_granted";
  stepUpUrl?: string;
  capability?: string;
  role?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /**
     * Either a list of field errors (validation) or a structured refusal
     * reason (authorisation). The backend uses the same key for both.
     */
    readonly details?: FieldError[] | RefusalDetail
  ) {
    super(message);
    this.name = "ApiError";
  }

  get fieldErrors(): FieldError[] | undefined {
    return Array.isArray(this.details) ? this.details : undefined;
  }

  get refusal(): RefusalDetail | undefined {
    return this.details && !Array.isArray(this.details)
      ? this.details
      : undefined;
  }

  /** True when signing with a wallet would resolve this refusal. */
  get needsWalletStepUp(): boolean {
    const reason = this.refusal?.reason;
    return reason === "wallet_required" || reason === "wallet_proof_stale";
  }

  /** Human-readable message including which fields failed. */
  get detailedMessage(): string {
    const fields = this.fieldErrors;
    if (!fields?.length) return this.message;
    return `${this.message}: ${fields
      .map((d) => `${d.field} - ${d.message}`)
      .join("; ")}`;
  }
}

/** Called when refreshing fails, so the app can drop back to signed-out. */
let onAuthLost: (() => void) | null = null;
export function setAuthLostHandler(handler: (() => void) | null) {
  onAuthLost = handler;
}

async function rawRequest<T>(
  path: string,
  init?: RequestInit,
  accessToken?: string | null
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the API at ${BASE_URL}. Is the backend running?`,
      0
    );
  }

  if (!response.ok) {
    let detail = response.statusText;
    let details: FieldError[] | RefusalDetail | undefined;
    try {
      const body = await response.json();
      detail = body?.message ?? body?.error ?? detail;
      if (body?.details) details = body.details;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new ApiError(detail, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Unauthenticated request. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return rawRequest<T>(path, init);
}

/**
 * In-flight refresh, shared across callers.
 *
 * Without this, several requests 401-ing at once would each POST /refresh.
 * Since the backend rotates on every use and treats a replayed token as
 * compromised, those concurrent refreshes would revoke the whole family and
 * log the user out.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const data = await rawRequest<AuthResponse>("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
      tokenStore.setAccessToken(data.accessToken);
      tokenStore.setRefreshToken(data.refreshToken);
      return data.accessToken;
    } catch {
      tokenStore.clear();
      onAuthLost?.();
      return null;
    } finally {
      // Cleared on the next tick so concurrent callers all observe this result.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

/**
 * Authenticated request. Retries once after refreshing on a 401.
 */
async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let token = tokenStore.getAccessToken();

  // No access token in memory (e.g. after a page reload) but a refresh token
  // on disk: get an access token before making the call.
  if (!token && tokenStore.getRefreshToken()) {
    token = await refreshAccessToken();
  }

  try {
    return await rawRequest<T>(path, init, token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;

    const refreshed = await refreshAccessToken();
    if (!refreshed) throw error;

    return rawRequest<T>(path, init, refreshed);
  }
}

export interface TenderSummary {
  _id: string;
  tenderId: string;
  tenderAddress: string;
  category?: string;
  summary?: {
    workType?: string;
    location?: string;
    estimatedValue?: string;
    confidence?: number;
    description?: string;
  };
  createdAt?: string;
}

export interface PublicSummariesResponse {
  summaries: TenderSummary[];
  total?: number;
  page?: number;
}

export interface SummaryStatistics {
  totalSummaries: number;
  averageConfidence?: number;
  byCategory?: Record<string, number>;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  // --- auth (unauthenticated by definition) ---

  getNonce: (walletAddress: string) =>
    request<NonceResponse>("/api/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    }),

  verifySignature: (payload: {
    message: string;
    signature: string;
    profile?: SignUpProfile;
  }) =>
    request<AuthResponse>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  register: (payload: RegisterPayload) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ success: boolean; message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    authedRequest<AuthResponse>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  logout: (refreshToken: string) =>
    request<{ success: boolean }>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  // --- authenticated ---

  me: () =>
    authedRequest<{
      user: AuthUser;
      capabilities?: Capability[];
      walletAddress?: string | null;
    }>("/api/auth/me"),

  /** The current session's capabilities, so the UI can enable the right actions. */
  session: () => authedRequest<{ session: SessionInfo }>("/api/auth/session"),

  /** Raise the current session to write:onchain by proving a wallet. */
  stepUp: (message: string, signature: string) =>
    authedRequest<StepUpResponse>("/api/auth/step-up", {
      method: "POST",
      body: JSON.stringify({ message, signature }),
    }),

  getProfile: () => authedRequest<{ user: AuthUser }>("/api/user/profile"),

  updateProfile: (patch: Partial<Pick<AuthUser, "email" | "phoneNumber" | "fullName">>) =>
    authedRequest<{ user: AuthUser }>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  // --- files ---

  getPublicSummaries: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    return request<PublicSummariesResponse>(
      `/api/files/public-summaries${qs ? `?${qs}` : ""}`
    );
  },

  getTenderSummary: (tenderAddress: string) =>
    request<TenderSummary>(`/api/files/tender-summary/${tenderAddress}`),

  getStatistics: () => request<SummaryStatistics>("/api/files/statistics"),

  // Upload is authenticated: it writes a summary attributed to the uploader.
  uploadTenderDocument: (form: FormData) =>
    authedRequest<{ summary?: TenderSummary; jobId?: string }>(
      "/api/files/upload-tender-document",
      { method: "POST", body: form }
    ),
};
