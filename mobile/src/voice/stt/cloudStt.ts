/**
 * Member 2 — Voice Engine
 * mobile/src/voice/stt/cloudStt.ts
 *
 * Cloud Speech-to-Text fallback using Google Cloud Speech API.
 * Only invoked when on-device confidence < threshold AND internet is available.
 * Sends the audio file as base64 to the backend proxy endpoint
 * (avoids exposing the API key on the device).
 */

import { apiClient } from '../../api/client';
import * as FileSystem from 'expo-file-system';

export interface SttResult {
  transcript: string;
  confidence: number;
  isFinal:    boolean;
  method:     'cloud';
}

/**
 * Sends an audio file URI to the backend cloud-stt proxy and returns
 * the transcription result.
 *
 * Backend endpoint: POST /api/v1/voice-logs/transcribe
 * Body: { audio_b64: string, language_code: string }
 * Response: { transcript: string, confidence: number }
 *
 * @param audioUri      Local file URI from recording
 * @param languageCode  BCP-47 locale, default 'ta-IN'
 */
export async function recognizeCloud(
  audioUri: string,
  languageCode = 'ta-IN',
): Promise<SttResult> {
  // Read audio file and encode as base64
  const audio_b64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await apiClient.post<{ transcript: string; confidence: number }>(
    '/api/v1/voice-logs/transcribe',
    { audio_b64, language_code: languageCode },
    { timeout: 20_000 },
  );

  return {
    transcript: response.data.transcript,
    confidence: response.data.confidence,
    isFinal:    true,
    method:     'cloud',
  };
}
