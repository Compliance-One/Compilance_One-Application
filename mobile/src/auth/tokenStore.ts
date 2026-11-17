/**
 * Access and refresh tokens live in expo-secure-store on a device.
 * A memory fallback is used when the native module is unavailable (tests, Expo Go web).
 */
const ACCESS_KEY = 'compliance-one.access_token';
const REFRESH_KEY = 'compliance-one.refresh_token';
const USER_KEY = 'compliance-one.user_profile';

const memory = new Map<string, string>();

async function store(): Promise<{
  getItemAsync: (k: string) => Promise<string | null>;
  setItemAsync: (k: string, v: string) => Promise<void>;
  deleteItemAsync: (k: string) => Promise<void>;
}> {
  try {
    return await import('expo-secure-store');
  } catch {
    /* fall through */
  }
  return {
    getItemAsync: async (k) => memory.get(k) ?? null,
    setItemAsync: async (k, v) => {
      memory.set(k, v);
    },
    deleteItemAsync: async (k) => {
      memory.delete(k);
    },
  };
}

export async function getAccessToken(): Promise<string | null> {
  return (await store()).getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return (await store()).getItemAsync(REFRESH_KEY);
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  const s = await store();
  await s.setItemAsync(ACCESS_KEY, access);
  await s.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  const s = await store();
  await s.deleteItemAsync(ACCESS_KEY);
  await s.deleteItemAsync(REFRESH_KEY);
  await s.deleteItemAsync(USER_KEY);
  memory.clear();
}

export async function getCachedUser(): Promise<{ id: string; name: string; phone?: string; email?: string } | null> {
  const raw = await (await store()).getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: string; name: string; phone?: string; email?: string };
  } catch {
    return null;
  }
}

export async function setCachedUser(user: { id: string; name: string; phone?: string; email?: string | null }): Promise<void> {
  await (await store()).setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearCachedUser(): Promise<void> {
  await (await store()).deleteItemAsync(USER_KEY);
}
