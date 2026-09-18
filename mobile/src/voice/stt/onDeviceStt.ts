/**
 * Member 2 — Voice Engine
 * mobile/src/voice/stt/onDeviceStt.ts
 *
 * On-device Tamil speech recognition using Android SpeechRecognizer
 * with EXTRA_PREFER_OFFLINE = true.
 * Wraps @react-native-voice/voice.
 */

import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

export interface SttResult {
  transcript:  string;
  confidence:  number;   // 0.0 – 1.0
  isFinal:     boolean;
  method:      'on-device';
}

let _resolve: ((r: SttResult) => void) | null = null;
let _reject:  ((e: Error) => void) | null = null;

Voice.onSpeechResults = (e: SpeechResultsEvent) => {
  if (!e.value || e.value.length === 0) return;
  const transcript = e.value[0];
  // Android does not always provide confidence scores; default to 0.75
  _resolve?.({ transcript, confidence: 0.75, isFinal: true, method: 'on-device' });
  cleanup();
};

Voice.onSpeechError = (e: SpeechErrorEvent) => {
  _reject?.(new Error(e.error?.message ?? 'Speech recognition error'));
  cleanup();
};

function cleanup() {
  _resolve = null;
  _reject  = null;
}

/**
 * Starts on-device speech recognition and returns when a final result arrives.
 * Times out after 10 seconds.
 *
 * @param languageCode  BCP-47 locale e.g. 'ta-IN'
 */
export async function recognizeOnDevice(
  languageCode = 'ta-IN',
): Promise<SttResult> {
  return new Promise<SttResult>((resolve, reject) => {
    _resolve = resolve;
    _reject  = reject;

    Voice.start(languageCode, {
      EXTRA_PREFER_OFFLINE: true,         // Android offline flag
      EXTRA_MAX_RESULTS:    5,
    }).catch((err) => {
      reject(new Error(`Voice.start failed: ${err.message}`));
      cleanup();
    });

    // Timeout safety net
    setTimeout(() => {
      Voice.stop().catch(() => {});
      reject(new Error('On-device STT timed out after 10s'));
      cleanup();
    }, 10_000);
  });
}

export async function stopRecognition(): Promise<void> {
  try {
    await Voice.stop();
  } catch {/* ignore */}
}

export async function cancelRecognition(): Promise<void> {
  try {
    await Voice.cancel();
  } catch {/* ignore */}
  cleanup();
}
