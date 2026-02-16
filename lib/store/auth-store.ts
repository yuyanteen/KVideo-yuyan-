/**
 * Auth Store - Simple module-level session management
 * NOT Zustand — needs to be synchronous at import time for store key generation
 */

export interface AuthSession {
  profileId: string;
  name: string;
  role: 'admin' | 'viewer';
}

const SESSION_KEY = 'kvideo-session';

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  // Check sessionStorage first, then localStorage (for persisted sessions)
  const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.profileId && parsed.name && parsed.role) {
      return parsed as AuthSession;
    }
  } catch {
    // Invalid session data
  }
  return null;
}

export function setSession(session: AuthSession, persist: boolean): void {
  if (typeof window === 'undefined') return;
  const data = JSON.stringify(session);
  sessionStorage.setItem(SESSION_KEY, data);
  if (persist) {
    localStorage.setItem(SESSION_KEY, data);
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  // Also clear old unlock keys for backward compat cleanup
  sessionStorage.removeItem('kvideo-unlocked');
  localStorage.removeItem('kvideo-unlocked');
}

export function isAdmin(): boolean {
  const session = getSession();
  if (!session) return true; // No auth configured = full access
  return session.role === 'admin';
}

export function getProfileId(): string {
  const session = getSession();
  return session?.profileId || '';
}
