import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG } from '../config/env';
import i18n from '../i18n';

/** Friendly, translated text for a recogniser error code. */
export function friendlySpeechError(code: string | undefined): string {
  switch (code) {
    case 'not-allowed':
      return i18n.t('voice.errPermission');
    case 'network':
      return i18n.t('voice.errNetwork');
    case 'no-speech':
    case 'speech-timeout':
      return i18n.t('voice.errNoSpeech');
    case 'busy':
      return i18n.t('voice.errBusy');
    case 'audio-capture':
      return i18n.t('voice.errMic');
    default:
      // language-not-supported, service-not-allowed, client, unknown: the
      // speech engine or its language pack is missing on this phone.
      return i18n.t('voice.errUnavailable');
  }
}

export type SpeechLocale = 'ta-IN' | 'en-IN';
export type ListenState = 'idle' | 'requesting' | 'listening' | 'stopping' | 'error';

export interface SpeechToTextState {
  state: ListenState;
  transcript: string;
  partial: string;
  error: string | null;
  onDevice: boolean;
  mocked: boolean;
}

const MOCK_PHRASES = [
  'Invoice for Rajesh Enterprises, 5 bags UltraTech Cement at 380 each with 28 percent GST and 12 pieces Havells switch at 140 each',
  'Add 10 cans Berger Interior Emulsion at 920 each and 4 boxes dry screws at 150',
];

export function useSpeechToText(lang: SpeechLocale) {
  const [state, setState] = useState<ListenState>('idle');
  const [transcript, setTranscript] = useState('');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [onDevice, setOnDevice] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const unsub = useRef<Array<{ remove: () => void }>>([]);
  const usedOnDevice = useRef(false);
  const retriedNetwork = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const detach = () => {
    unsub.current.forEach((s) => s.remove());
    unsub.current = [];
  };

  useEffect(() => () => {
    clearTimers();
    detach();
    if (!CONFIG.MOCK_STT) {
      void import('expo-speech-recognition')
        .then((m) => {
          m.ExpoSpeechRecognitionModule.abort();
        })
        .catch(() => undefined);
    }
  }, []);

  const startMock = useCallback(() => {
    clearTimers();
    setError(null);
    setTranscript('');
    setPartial('');
    setState('listening');
    const phrase = MOCK_PHRASES[Math.floor(Math.random() * MOCK_PHRASES.length)];
    const words = phrase.split(' ');
    let i = 0;
    const tick = () => {
      i += 1;
      setPartial(words.slice(0, i).join(' '));
      if (i < words.length) {
        timers.current.push(setTimeout(tick, 80));
      } else {
        timers.current.push(
          setTimeout(() => {
            setTranscript(phrase);
            setPartial('');
            setState('idle');
          }, 200)
        );
      }
    };
    timers.current.push(setTimeout(tick, 200));
  }, []);

  const startNative = useCallback(async (forceNetwork = false) => {
    const speech = await import('expo-speech-recognition');
    const { ExpoSpeechRecognitionModule } = speech;
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setState('error');
      setError(friendlySpeechError('not-allowed'));
      return;
    }

    detach();
    unsub.current = [
      speech.ExpoSpeechRecognitionModule.addListener('start', () => {
        setState('listening');
        setError(null);
      }),
      speech.ExpoSpeechRecognitionModule.addListener('end', () => {
        setState((s) => (s === 'error' ? s : 'idle'));
        setPartial('');
      }),
      speech.ExpoSpeechRecognitionModule.addListener('result', (event: { results?: Array<{ transcript?: string }>; isFinal?: boolean }) => {
        const text = (event.results ?? []).map((r) => r.transcript ?? '').join(' ').trim();
        if (!text) return;
        if (event.isFinal) {
          setTranscript(text);
          setPartial('');
        } else {
          setPartial(text);
        }
      }),
      speech.ExpoSpeechRecognitionModule.addListener('error', (event: { error?: string; message?: string }) => {
        const code = event.error ?? 'unknown';
        if (!forceNetwork && usedOnDevice.current && !retriedNetwork.current && code !== 'aborted' && code !== 'not-allowed') {
          retriedNetwork.current = true;
          usedOnDevice.current = false;
          setOnDevice(false);
          void startNative(true);
          return;
        }
        if (code === 'aborted') {
          setState('idle');
          return;
        }
        setState('error');
        if (__DEV__) console.warn('[voice] recogniser error', code, event.message);
        setError(friendlySpeechError(code));
      }),
    ];

    if (ExpoSpeechRecognitionModule.isRecognitionAvailable && !ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setState('error');
      setError(friendlySpeechError('service-not-allowed'));
      return;
    }

    const supportsOnDevice =
      !forceNetwork && (ExpoSpeechRecognitionModule.supportsOnDeviceRecognition?.() ?? false);
    usedOnDevice.current = supportsOnDevice;
    setOnDevice(supportsOnDevice);
    retriedNetwork.current = forceNetwork ? retriedNetwork.current : false;

    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: supportsOnDevice,
    });
    setState('listening');
  }, [lang]);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    setPartial('');
    setState('requesting');
    if (CONFIG.MOCK_STT) {
      startMock();
      return;
    }
    try {
      await startNative(false);
    } catch (e) {
      if (__DEV__) console.warn('[voice] start failed', e);
      setState('error');
      setError(friendlySpeechError('service-not-allowed'));
    }
  }, [startMock, startNative]);

  const stop = useCallback(async () => {
    if (CONFIG.MOCK_STT) {
      clearTimers();
      setPartial((p) => {
        if (p) setTranscript(p);
        return '';
      });
      setState('idle');
      return;
    }
    setState('stopping');
    try {
      const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition');
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setState('idle');
    }
  }, []);

  const cancel = useCallback(async () => {
    if (CONFIG.MOCK_STT) {
      clearTimers();
      setPartial('');
      setTranscript('');
      setState('idle');
      return;
    }
    try {
      const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition');
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* already stopped */
    }
    setPartial('');
    setState('idle');
  }, []);

  const display = partial || transcript;

  return {
    state,
    transcript,
    partial,
    display,
    error,
    onDevice,
    mocked: CONFIG.MOCK_STT,
    start,
    stop,
    cancel,
  };
}
