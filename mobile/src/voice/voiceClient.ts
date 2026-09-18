/**
 * mobile/src/voice/voiceClient.ts
 *
 * Safe wrapper around @react-native-voice/voice.
 *
 * - On a proper Development Build (ejected / expo-dev-client), the real
 *   native module is available and full STT works.
 * - On standard Expo Go, NativeModules.Voice doesn't exist — we return a
 *   no-op shim so the screen stays functional (keyboard mode is offered instead).
 */

import { NativeModules, Platform } from 'react-native';

// Check if the native Voice module is actually linked
const nativeVoiceAvailable =
  Platform.OS !== 'web' && !!NativeModules.Voice;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RealVoice = nativeVoiceAvailable
  ? require('@react-native-voice/voice').default
  : null;

// No-op shim used when the native module isn't available (Expo Go)
const VoiceShim = {
  isAvailable: async () => false,
  start: async (_locale?: string) => {},
  stop: async () => {},
  destroy: async () => {},
  removeAllListeners: () => {},
  onSpeechStart: null as any,
  onSpeechRecognized: null as any,
  onSpeechEnd: null as any,
  onSpeechError: null as any,
  onSpeechResults: null as any,
  onSpeechPartialResults: null as any,
  onSpeechVolumeChanged: null as any,
};

export const isVoiceNativeAvailable = nativeVoiceAvailable;

export default (RealVoice ?? VoiceShim) as typeof VoiceShim;
