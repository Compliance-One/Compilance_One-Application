// mobile/src/voice/voiceMock.ts
// Safe shim for @react-native-voice/voice when running in Expo Go.
// The real native module is only available in a development build.
const VoiceShim = {
  isAvailable: async () => false,
  start:  async (_locale?: string) => {},
  stop:   async () => {},
  destroy: async () => {},
  removeAllListeners: () => {},
  onSpeechStart:         null as any,
  onSpeechRecognized:    null as any,
  onSpeechEnd:           null as any,
  onSpeechError:         null as any,
  onSpeechResults:       null as any,
  onSpeechPartialResults:null as any,
  onSpeechVolumeChanged: null as any,
};

export interface SpeechResultsEvent {
  value?: string[];
}

export interface SpeechErrorEvent {
  error?: {
    code?: string;
    message?: string;
  };
}

export default VoiceShim;
