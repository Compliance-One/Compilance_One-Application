/**
 * Member 2 — Voice Engine
 * mobile/src/voice/stt/sttRouter.ts
 *
 * Decision router: tries on-device STT first.
 * Falls back to cloud only if confidence < threshold AND internet available.
 */

import { recognizeOnDevice } from './onDeviceStt';
import { recognizeCloud }    from './cloudStt';
import { isOnline }          from '../../sync/netListener';

const ON_DEVICE_CONFIDENCE_THRESHOLD = 0.60;

export interface SttRouterResult {
  transcript:       string;
  confidence:       number;
  method:           'on-device' | 'cloud';
  usedCloudFallback: boolean;
}

/**
 * Transcribes speech using the best available method.
 *
 * Flow:
 *  1. Run on-device STT
 *  2. If confidence >= 0.60 → return on-device result
 *  3. Else if online       → run cloud STT and return that
 *  4. Else                 → return on-device result with low-confidence flag
 */
export async function transcribe(
  languageCode = 'ta-IN',
): Promise<SttRouterResult> {
  const onDeviceResult = await recognizeOnDevice(languageCode);

  if (onDeviceResult.confidence >= ON_DEVICE_CONFIDENCE_THRESHOLD) {
    return {
      transcript:        onDeviceResult.transcript,
      confidence:        onDeviceResult.confidence,
      method:            'on-device',
      usedCloudFallback: false,
    };
  }

  // Low confidence — try cloud if possible
  console.log(
    `[STTRouter] On-device confidence ${onDeviceResult.confidence} < threshold. Checking internet...`,
  );

  const online = await isOnline();
  if (!online) {
    // No internet — return on-device result anyway with warning
    console.warn('[STTRouter] Offline — returning low-confidence on-device result');
    return {
      transcript:        onDeviceResult.transcript,
      confidence:        onDeviceResult.confidence,
      method:            'on-device',
      usedCloudFallback: false,
    };
  }

  try {
    // Note: cloud STT requires an audio URI (recorded file).
    // For now we re-use the transcript from on-device if we don't have a file URI.
    // In full implementation, VoiceBilling screen passes the recorded file URI.
    const cloudResult = await recognizeCloud('', languageCode);
    return {
      transcript:        cloudResult.transcript,
      confidence:        cloudResult.confidence,
      method:            'cloud',
      usedCloudFallback: true,
    };
  } catch (err) {
    console.warn('[STTRouter] Cloud STT failed, falling back to on-device:', err);
    return {
      transcript:        onDeviceResult.transcript,
      confidence:        onDeviceResult.confidence,
      method:            'on-device',
      usedCloudFallback: false,
    };
  }
}
