import { Platform } from 'react-native';

const getDevApiBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return 'http://localhost:8000/api/v1';
};

export const CONFIG = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || getDevApiBaseUrl(),
  SYNC_POLL_INTERVAL_MS: 30000,
  MAX_RETRY_COUNT: 5,
};
