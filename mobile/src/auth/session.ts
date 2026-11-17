import { apiClient } from '../api/client';
import { ensureBusinessLinked } from '../db/repositories';
import { getDb } from '../db/schema';
import { useAppStore, type UserProfile } from '../store/useAppStore';
import { startRuntimeSync, stopRuntimeSync } from '../sync/lifecycle';
import { clearTokens, getAccessToken, getCachedUser, getRefreshToken, setCachedUser, setTokens } from './tokenStore';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

function toProfile(user: AuthUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email ?? '',
  };
}

async function applySession(tokens: TokenResponse): Promise<void> {
  await setTokens(tokens.access_token, tokens.refresh_token);
  apiClient.setAuthToken(tokens.access_token);
  await attachBusiness(tokens.user);
}

async function attachBusiness(user: AuthUser): Promise<void> {
  const profile = toProfile(user);
  useAppStore.getState().setUser(profile);
  await setCachedUser(profile);
  const db = await getDb();
  const business = await ensureBusinessLinked(db, user.id);
  useAppStore.getState().setBusiness({
    id: business.id,
    name: business.name,
    gstin: business.gstin ?? undefined,
    stateCode: business.stateCode,
    openingCash: business.openingCash,
    openingBank: business.openingBank,
  });
  await startRuntimeSync();
}

export async function login(identifier: string, password: string): Promise<void> {
  const tokens = await apiClient.requestJson<TokenResponse>('/auth/login', {
    method: 'POST',
    json: { identifier, password },
  });
  await applySession(tokens);
}

export async function register(input: {
  name: string;
  phone: string;
  password: string;
  email?: string;
}): Promise<void> {
  const tokens = await apiClient.requestJson<TokenResponse>('/auth/register', {
    method: 'POST',
    json: input,
  });
  await applySession(tokens);
}

export async function refreshSession(): Promise<boolean> {
  const refresh = await getRefreshToken();
  if (!refresh) return false;
  try {
    const tokens = await apiClient.requestJson<TokenResponse>('/auth/refresh', {
      method: 'POST',
      json: { refresh_token: refresh },
    });
    await setTokens(tokens.access_token, tokens.refresh_token);
    apiClient.setAuthToken(tokens.access_token);
    useAppStore.getState().setUser(toProfile(tokens.user));
    return true;
  } catch {
    return false;
  }
}

export function installRefreshHandler(): void {
  apiClient.setRefreshHandler(refreshSession);
}

export async function hydrateAuth(): Promise<boolean> {
  const access = await getAccessToken();
  const refresh = await getRefreshToken();
  if (!access && !refresh) {
    useAppStore.getState().setUser(null);
    return false;
  }
  apiClient.setAuthToken(access);
  const me = await fetchMe();
  if (me) {
    await attachBusiness(me);
    return true;
  }
  if (refresh) {
    const ok = await refreshSession();
    if (ok) {
      const again = await fetchMe();
      if (again) {
        await attachBusiness(again);
        return true;
      }
    }
  }
  // Stay signed in offline with the cached profile so the device can keep working.
  const cached = await getCachedUser();
  if (cached && access) {
    await attachBusiness({
      id: cached.id,
      name: cached.name,
      phone: cached.phone ?? '',
      email: cached.email,
    });
    return true;
  }
  await logout(false);
  return false;
}

async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await apiClient.requestJson<AuthUser>('/auth/me');
  } catch {
    return null;
  }
}

export async function logout(revokeRemote = true): Promise<void> {
  if (revokeRemote) {
    const refresh = await getRefreshToken();
    if (refresh) {
      try {
        await apiClient.request('/auth/logout', {
          method: 'POST',
          json: { refresh_token: refresh },
        });
      } catch {
        /* still clear local session */
      }
    }
  }
  stopRuntimeSync();
  await clearTokens();
  apiClient.setAuthToken(null);
  useAppStore.getState().setUser(null);
  useAppStore.getState().setBusiness(null);
}

export function parseAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('(409)')) return 'auth.duplicate';
  if (raw.includes('(401)')) return 'auth.invalidCredentials';
  return 'auth.genericError';
}
