import type { NavigatorScreenParams } from '@react-navigation/native';

export type InvoiceCreateParams = {
  initialCustomer?: {
    id?: string;
    name?: string;
    gstin?: string;
    phone?: string;
    stateCode?: string;
    stateName?: string;
    billingAddress?: string;
  };
  initialItems?: Array<{
    id?: string;
    name?: string;
    hsnCode?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    taxRate?: number;
    stateCode?: string;
  }>;
  inputMode?: 'voice' | 'text';
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  VoiceBilling: undefined;
  InvoiceCreate: InvoiceCreateParams | undefined;
  Customers: undefined;
  Inventory: undefined;
  Ledger: undefined;
  ProfitLoss: undefined;
  BalanceSheet: undefined;
  GSTR1Export: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Invoices: undefined;
  Products: undefined;
  Reports: undefined;
  Settings: undefined;
};

/** Legacy route names used by the reports screens via ScreenProps. */
export type RouteName =
  | 'dashboard'
  | 'reports'
  | 'ledger'
  | 'gstr1'
  | 'settings'
  | 'profitLoss'
  | 'balanceSheet'
  | 'invoices'
  | 'products'
  | 'customers'
  | 'inventory'
  | 'voiceBilling'
  | 'invoiceCreate';

export interface ScreenProps {
  navigate: (route: RouteName) => void;
  back: () => void;
  /** true when this screen was pushed on top of another (show a Back chip) */
  canGoBack: boolean;
}

export const ROUTE_MAP: Record<RouteName, keyof RootStackParamList | { tab: keyof MainTabParamList }> = {
  dashboard: { tab: 'Dashboard' },
  reports: { tab: 'Reports' },
  settings: { tab: 'Settings' },
  invoices: { tab: 'Invoices' },
  products: { tab: 'Products' },
  ledger: 'Ledger',
  gstr1: 'GSTR1Export',
  profitLoss: 'ProfitLoss',
  balanceSheet: 'BalanceSheet',
  customers: 'Customers',
  inventory: 'Inventory',
  voiceBilling: 'VoiceBilling',
  invoiceCreate: 'InvoiceCreate',
};
