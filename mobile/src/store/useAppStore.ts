import { create } from 'zustand';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export interface BusinessSession {
  id: string;
  name: string;
  gstin?: string;
  stateCode?: string;
}

export interface AppStoreState {
  user: UserProfile | null;
  business: BusinessSession | null;
  isAuthenticated: boolean;
  isOnline: boolean;
  networkType: string;
  pendingSyncCount: number;
  lastSyncedAt: string | null;
  activeVoiceDraftId: string | null;

  setUser: (user: UserProfile | null) => void;
  setBusiness: (business: BusinessSession | null) => void;
  updateBusiness: (patch: Partial<BusinessSession>) => void;
  setOnlineStatus: (isOnline: boolean, networkType?: string) => void;
  setPendingSyncCount: (count: number) => void;
  incrementPendingSyncCount: () => void;
  decrementPendingSyncCount: () => void;
  setLastSyncedAt: (timestamp: string | null) => void;
  setActiveVoiceDraftId: (draftId: string | null) => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  user: null,
  business: null,
  isAuthenticated: false,
  isOnline: true,
  networkType: 'UNKNOWN',
  pendingSyncCount: 0,
  lastSyncedAt: null,
  activeVoiceDraftId: null,

  setUser: (user: UserProfile | null) => set({ user, isAuthenticated: !!user }),

  setBusiness: (business: BusinessSession | null) => set({ business }),

  updateBusiness: (patch: Partial<BusinessSession>) =>
    set((state: AppStoreState) => ({
      business: state.business ? { ...state.business, ...patch } : null,
    })),

  setOnlineStatus: (isOnline: boolean, networkType = 'UNKNOWN') =>
    set({ isOnline, networkType }),

  setPendingSyncCount: (count: number) => set({ pendingSyncCount: Math.max(0, count) }),

  incrementPendingSyncCount: () =>
    set((state: AppStoreState) => ({ pendingSyncCount: state.pendingSyncCount + 1 })),

  decrementPendingSyncCount: () =>
    set((state: AppStoreState) => ({
      pendingSyncCount: Math.max(0, state.pendingSyncCount - 1),
    })),

  setLastSyncedAt: (timestamp: string | null) => set({ lastSyncedAt: timestamp }),

  setActiveVoiceDraftId: (draftId: string | null) => set({ activeVoiceDraftId: draftId }),
}));
