/**
 * Member 3 — State Management
 * mobile/src/store/useAppStore.ts
 *
 * Single Zustand store for all cross-screen state:
 *   - User session (JWT, user, business)
 *   - Network status (offline/online)
 *   - Active billing draft (line items from voice)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, Business } from '../db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LineItem {
  productId:    string | null;
  productName:  string;
  hsnCode:      string;
  quantity:     number;
  unit:         string;
  rate:         number;
  discount:     number;
  gstRate:      number;
  taxableAmount:number;
  cgst:         number;
  sgst:         number;
  igst:         number;
  total:        number;
}

interface AppState {
  // ── Session ──────────────────────────────────────────────────────────────
  user:       User | null;
  business:   Business | null;
  jwtToken:   string | null;

  setSession:   (user: User, business: Business, token: string) => void;
  clearSession: () => void;

  // ── Network ───────────────────────────────────────────────────────────────
  isOffline:    boolean;
  pendingSyncCount: number;
  setOffline:   (v: boolean) => void;
  setPendingSync: (count: number) => void;

  // ── Active billing draft ──────────────────────────────────────────────────
  draftLineItems:  LineItem[];
  draftCustomerId: string | null;
  setDraftLineItems:  (items: LineItem[]) => void;
  setDraftCustomer:   (customerId: string | null) => void;
  addDraftLineItem:   (item: LineItem) => void;
  updateDraftLineItem:(index: number, item: Partial<LineItem>) => void;
  removeDraftLineItem:(index: number) => void;
  clearDraft:         () => void;

  // ── UI preferences ────────────────────────────────────────────────────────
  language:   'ta' | 'en' | 'tanglish';
  setLanguage:(lang: 'ta' | 'en' | 'tanglish') => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Session ────────────────────────────────────────────────────────────
      user:     null,
      business: null,
      jwtToken: null,

      setSession: (user, business, token) =>
        set({ user, business, jwtToken: token }),

      clearSession: () =>
        set({ user: null, business: null, jwtToken: null, draftLineItems: [] }),

      // ── Network ────────────────────────────────────────────────────────────
      isOffline:        false,
      pendingSyncCount: 0,
      setOffline:       (v) => set({ isOffline: v }),
      setPendingSync:   (count) => set({ pendingSyncCount: count }),

      // ── Draft billing ──────────────────────────────────────────────────────
      draftLineItems:  [],
      draftCustomerId: null,

      setDraftLineItems:  (items)   => set({ draftLineItems: items }),
      setDraftCustomer:   (id)      => set({ draftCustomerId: id }),

      addDraftLineItem: (item) =>
        set((state) => ({ draftLineItems: [...state.draftLineItems, item] })),

      updateDraftLineItem: (index, patch) =>
        set((state) => {
          const items = [...state.draftLineItems];
          items[index] = { ...items[index], ...patch };
          return { draftLineItems: items };
        }),

      removeDraftLineItem: (index) =>
        set((state) => ({
          draftLineItems: state.draftLineItems.filter((_, i) => i !== index),
        })),

      clearDraft: () => set({ draftLineItems: [], draftCustomerId: null }),

      // ── UI prefs ───────────────────────────────────────────────────────────
      language:    'ta',
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name:    'compliance-one-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist session + language — network/draft state is transient
      partialize: (state) => ({
        user:       state.user,
        business:   state.business,
        jwtToken:   state.jwtToken,
        language:   state.language,
      }),
    },
  ),
);
