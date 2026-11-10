import { create } from 'zustand';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'BILLING_STAFF';
  avatarUrl?: string;
}

export interface BusinessSession {
  id: string;
  legalName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  stateCode: string;
  stateName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  currency: string;
  invoicePrefix: string;
  isCompositionScheme: boolean;
}

export interface AppStoreState {
  // Session & Profile
  user: UserProfile | null;
  business: BusinessSession | null;
  isAuthenticated: boolean;

  // Offline & Sync Status
  isOnline: boolean;
  networkType: 'WIFI' | 'CELLULAR' | 'NONE' | 'UNKNOWN';
  pendingSyncCount: number;
  lastSyncedAt: string | null;

  // Voice Billing Active Cache
  activeVoiceDraftId: string | null;

  // Actions
  setUser: (user: UserProfile | null) => void;
  setBusiness: (business: BusinessSession | null) => void;
  updateBusiness: (patch: Partial<BusinessSession>) => void;
  setOnlineStatus: (isOnline: boolean, networkType?: 'WIFI' | 'CELLULAR' | 'NONE' | 'UNKNOWN') => void;
  setPendingSyncCount: (count: number) => void;
  incrementPendingSync: () => void;
  decrementPendingSync: () => void;
  setLastSyncedAt: (timestamp: string) => void;
  setActiveVoiceDraftId: (draftId: string | null) => void;
  clearSession: () => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  user: {
    id: 'usr_001',
    name: 'Rajesh Sharma',
    email: 'rajesh@complianceone.in',
    phone: '+91 98765 43210',
    role: 'OWNER',
  },
  business: {
    id: 'biz_001',
    legalName: 'Apex Enterprise Private Limited',
    tradeName: 'Apex Tools & Hardware',
    gstin: '27AABCA1234F1Z5',
    pan: 'AABCA1234F',
    stateCode: '27',
    stateName: 'Maharashtra',
    email: 'billing@apexenterprise.com',
    phone: '+91 22 2345 6789',
    address: {
      street: 'Plot No. 42, MIDC Industrial Area, Andheri East',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400093',
    },
    currency: 'INR',
    invoicePrefix: 'APX-26/',
    isCompositionScheme: false,
  },
  isAuthenticated: true,

  isOnline: true,
  networkType: 'WIFI',
  pendingSyncCount: 0,
  lastSyncedAt: new Date().toISOString(),

  activeVoiceDraftId: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setBusiness: (business) => set({ business }),

  updateBusiness: (patch) =>
    set((state) => ({
      business: state.business ? { ...state.business, ...patch } : null,
    })),

  setOnlineStatus: (isOnline, networkType = 'UNKNOWN') =>
    set({
      isOnline,
      networkType: isOnline ? networkType : 'NONE',
    }),

  setPendingSyncCount: (count) => set({ pendingSyncCount: Math.max(0, count) }),

  incrementPendingSync: () =>
    set((state) => ({ pendingSyncCount: state.pendingSyncCount + 1 })),

  decrementPendingSync: () =>
    set((state) => ({
      pendingSyncCount: Math.max(0, state.pendingSyncCount - 1),
    })),

  setLastSyncedAt: (timestamp) => set({ lastSyncedAt: timestamp }),

  setActiveVoiceDraftId: (draftId) => set({ activeVoiceDraftId: draftId }),

  clearSession: () =>
    set({
      user: null,
      business: null,
      isAuthenticated: false,
      pendingSyncCount: 0,
      activeVoiceDraftId: null,
    }),
}));

