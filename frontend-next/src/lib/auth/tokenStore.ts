/**
 * Token storage.
 *
 * The access token is held in memory only. Keeping a bearer token out of
 * localStorage means an XSS payload cannot simply read it out of storage, and
 * it is short-lived (15m) anyway.
 *
 * The refresh token does go to localStorage, because a full page load would
 * otherwise log the user out. That is a deliberate trade-off: it is the weaker
 * link, which is why the backend rotates it on every use and revokes the whole
 * token family if a rotated token is ever replayed.
 */

const REFRESH_KEY = "tenderchain.refreshToken";

let accessToken: string | null = null;

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },

  setAccessToken(token: string | null) {
    accessToken = token;
  },

  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(REFRESH_KEY);
    } catch {
      // Storage can throw in private modes / when disabled.
      return null;
    }
  },

  setRefreshToken(token: string | null) {
    if (typeof window === "undefined") return;
    try {
      if (token) window.localStorage.setItem(REFRESH_KEY, token);
      else window.localStorage.removeItem(REFRESH_KEY);
    } catch {
      // Non-fatal: the session simply will not survive a reload.
    }
  },

  clear() {
    accessToken = null;
    this.setRefreshToken(null);
  },
};
