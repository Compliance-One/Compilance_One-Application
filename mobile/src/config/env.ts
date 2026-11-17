import { Platform } from 'react-native';

const getDevApiBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return 'http://localhost:8000/api/v1';
};

export const CONFIG = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || getDevApiBaseUrl(),
  SYNC_POLL_INTERVAL_MS: 30_000,
  MAX_RETRY_COUNT: 5,
  DEFAULT_STATE_CODE: '33',
  /**
   * When true, Voice Billing uses the scripted mock recognizer instead of
   * expo-speech-recognition. Enable with EXPO_PUBLIC_MOCK_STT=1. Keep this
   * off in development and production builds on a real device.
   */
  MOCK_STT: process.env.EXPO_PUBLIC_MOCK_STT === '1',
};
