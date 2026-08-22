import { create } from 'zustand';

/**
 * Access token lives in memory only (PRD §8.3) — never localStorage — to keep
 * it out of reach of XSS. The refresh token is an httpOnly cookie the API set
 * at login, so the client never touches it.
 */
export const useAuthStore = create((set) => ({
  accessToken: null,
  user: null,
  // False until the app's initial session-restore attempt (refresh cookie)
  // has settled — auth-gated routes wait for this instead of bouncing to
  // /login during a hard reload.
  hydrated: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  setUser: (user) => set({ user }),
  setHydrated: () => set({ hydrated: true }),
  clear: () => set({ accessToken: null, user: null }),
}));
