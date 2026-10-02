import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetworkCallback = (isConnected: boolean) => void;

export class NetworkListener {
  private unsubscribe: (() => void) | null = null;

  startListening(callback: NetworkCallback): void {
    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      callback(isOnline);
    });
  }

  stopListening(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  async checkCurrentStatus(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  }
}
