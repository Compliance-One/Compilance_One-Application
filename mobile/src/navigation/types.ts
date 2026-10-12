export type RouteName =
  | 'dashboard'
  | 'reports'
  | 'ledger'
  | 'gstr1'
  | 'settings'
  | 'profitLoss'
  | 'balanceSheet';

export interface ScreenProps {
  navigate: (route: RouteName) => void;
  back: () => void;
  /** true when this screen was pushed on top of another (show a Back chip) */
  canGoBack: boolean;
}
