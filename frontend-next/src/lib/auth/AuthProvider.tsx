"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SiweMessage } from "siwe";
import { api, ApiError, setAuthLostHandler } from "@/lib/api/client";
import type {
  AuthUser,
  LinkedWallet,
  RegisterPayload,
  SignUpProfile,
} from "@/lib/api/types";
import { EXPECTED_CHAIN_ID } from "@/lib/contracts/addresses";
import { useWallet } from "@/lib/web3/WalletProvider";
import { tokenStore } from "./tokenStore";

/**
 * Sign-In With Ethereum against the backend.
 *
 * The wallet connection (WalletProvider) and the API session are separate
 * concerns: a connected wallet is not a signed-in user. Connecting only
 * exposes an address; signing in proves control of it to the server.
 */

export type AuthStatus =
  | "loading" // restoring a session from the stored refresh token
  | "signedOut"
  | "signingIn"
  | "signedIn"
  | "needsProfile"; // wallet is new to the backend, needs registration details

interface AuthState {
  status: AuthStatus;
  /**
   * True from the moment the backend asks for registration details until
   * sign-in succeeds or is abandoned. The UI uses it to keep the profile form
   * mounted while a signature is pending - otherwise status briefly leaves
   * "needsProfile", the form unmounts, and the user's typed input is lost.
   */
  isRegistering: boolean;
  user: AuthUser | null;
  /** Wallets this account has proven control of; may be empty. */
  wallets: LinkedWallet[];
  /** The wallet bound to the current session, if any. */
  sessionWallet: string | null;
  error: string | null;
  /** Sign in by proving control of the connected wallet. */
  signIn: (profile?: SignUpProfile) => Promise<void>;
  /** Sign in with email and password; no wallet required. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Create an account with a password; no wallet required. */
  register: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { account, signer } = useWallet();

  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isRegistering, setIsRegistering] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setWallets([]);
    setSessionWallet(null);
    setStatus("signedOut");
    setIsRegistering(false);
  }, []);

  // If a refresh fails deep inside the API client, drop to signed-out.
  useEffect(() => {
    setAuthLostHandler(() => reset());
    return () => setAuthLostHandler(null);
  }, [reset]);

  // Restore a session on mount using the stored refresh token.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!tokenStore.getRefreshToken()) {
        if (!cancelled) setStatus("signedOut");
        return;
      }

      try {
        const { user: me } = await api.me();
        if (cancelled) return;
        setUser(me);
        setStatus("signedIn");
      } catch {
        if (cancelled) return;
        tokenStore.clear();
        setStatus("signedOut");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * If the wallet switches to a different account than the signed-in session,
   * the session no longer matches who is holding the wallet. Sign out rather
   * than letting the two drift apart.
   */
  useEffect(() => {
    if (status !== "signedIn" || !sessionWallet || !account) return;
    // Only relevant when the session is wallet-bound: a password session is not
    // tied to whichever account the wallet happens to be showing.
    if (account.toLowerCase() !== sessionWallet.toLowerCase()) {
      void (async () => {
        const refreshToken = tokenStore.getRefreshToken();
        if (refreshToken) await api.logout(refreshToken).catch(() => {});
        reset();
        setError("Wallet account changed, so you were signed out.");
      })();
    }
  }, [account, sessionWallet, status, reset]);

  const signIn = useCallback(
    async (profile?: SignUpProfile) => {
      setError(null);

      if (!signer || !account) {
        setError("Connect your wallet first.");
        return;
      }

      setStatus("signingIn");

      try {
        const nonce = await api.getNonce(account);

        const message = new SiweMessage({
          domain: nonce.domain,
          address: account,
          statement: nonce.statement,
          uri: nonce.uri,
          version: "1",
          chainId: nonce.chainId,
          nonce: nonce.nonce,
          issuedAt: new Date().toISOString(),
        }).prepareMessage();

        const signature = await signer.signMessage(message);

        const result = await api.verifySignature({ message, signature, profile });

        tokenStore.setAccessToken(result.accessToken);
        tokenStore.setRefreshToken(result.refreshToken);
        setUser(result.user);
        setWallets(result.wallets ?? []);
        setSessionWallet(result.walletAddress ?? account);
        setStatus("signedIn");
        setIsRegistering(false);
      } catch (err) {
        // The backend asks for profile fields when the wallet is unknown.
        // Surface that as a distinct state so the UI can collect them, rather
        // than as a generic failure.
        if (
          err instanceof ApiError &&
          err.status === 400 &&
          /profile\./i.test(err.message)
        ) {
          setStatus("needsProfile");
          setIsRegistering(true);
          return;
        }

        // Prefer the per-field detail when the backend supplied it, so a
        // rejected email or phone number says which field was wrong.
        const message =
          err instanceof ApiError
            ? err.detailedMessage
            : err instanceof Error
              ? err.message
              : "Sign-in failed";

        setError(
          /user rejected|denied|4001/i.test(message)
            ? "Signature request was rejected in your wallet."
            : message
        );

        // A validation failure on registration should keep the form up so the
        // user can correct it, rather than dropping back to the start.
        setStatus(
          err instanceof ApiError && err.status === 400 && profile
            ? "needsProfile"
            : "signedOut"
        );
      }
    },
    [signer, account]
  );

  /** Applies a successful auth response to local state. */
  const adoptSession = useCallback(
    (result: {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
      wallets?: LinkedWallet[];
      walletAddress?: string | null;
    }) => {
      tokenStore.setAccessToken(result.accessToken);
      tokenStore.setRefreshToken(result.refreshToken);
      setUser(result.user);
      setWallets(result.wallets ?? []);
      // Null for a password session: it can read and manage the profile, but
      // cannot act on chain until a wallet is proven.
      setSessionWallet(result.walletAddress ?? null);
      setStatus("signedIn");
      setIsRegistering(false);
    },
    []
  );

  const describeError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof ApiError) return err.detailedMessage;
    return err instanceof Error ? err.message : fallback;
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setStatus("signingIn");
      try {
        adoptSession(await api.login(email, password));
      } catch (err) {
        setError(describeError(err, "Sign-in failed"));
        setStatus("signedOut");
      }
    },
    [adoptSession, describeError]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setError(null);
      setStatus("signingIn");
      try {
        adoptSession(await api.register(payload));
      } catch (err) {
        setError(describeError(err, "Registration failed"));
        setStatus("signedOut");
      }
    },
    [adoptSession, describeError]
  );

  const signOut = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();
    if (refreshToken) {
      // Best effort: revoke server-side, but always clear locally.
      await api.logout(refreshToken).catch(() => {});
    }
    reset();
  }, [reset]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      isRegistering,
      user,
      wallets,
      sessionWallet,
      error,
      signIn,
      signInWithPassword,
      register,
      signOut,
      clearError: () => setError(null),
    }),
    [
      status,
      isRegistering,
      user,
      wallets,
      sessionWallet,
      error,
      signIn,
      signInWithPassword,
      register,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}

/** Convenience: does the signed-in user hold one of these roles? */
export function useHasRole(...roles: AuthUser["userType"][]): boolean {
  const { user } = useAuth();
  return !!user && roles.includes(user.userType);
}

export { EXPECTED_CHAIN_ID };
