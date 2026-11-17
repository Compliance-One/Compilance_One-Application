# Compliance One — mobile app

Offline-first GST invoicing for Indian micro-enterprises. Voice billing, thermal receipt printing, and PDF tax invoices need **native modules**, so this app runs as an Expo **development build** (or a production/EAS binary). It will **not** work in Expo Go.

## Prerequisites

- Node.js 20+
- Android Studio / Xcode (for a local native run), or an [EAS](https://docs.expo.dev/build/introduction/) account for a cloud dev build
- A physical device is required to verify the microphone and a Bluetooth ESC/POS printer

## Install

```bash
cd mobile
npm install
```

## Development build (required for STT, Bluetooth, and a full native run)

Config plugins live in `app.json` (`expo-speech-recognition`, `react-native-thermal-printer-driver`, `expo-build-properties` for cleartext HTTP to the local API). The generated `android/` and `ios/` folders are gitignored; regenerate them when plugins change.

### Option A — local prebuild and run

```bash
# Generate the native projects (do not commit android/ or ios/)
npx expo prebuild --platform android

# Compile and install a dev client on a device or emulator
npx expo run:android

# Then start the bundler (this package's npm start already uses --dev-client)
npx expo start --dev-client
```

On iOS: `npx expo prebuild --platform ios` then `npx expo run:ios`. Bluetooth Classic receipt printers are Android-only; use BLE or TCP on iOS.

### Option B — EAS development build

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

Install the resulting APK, then run `npx expo start --dev-client` and scan the QR code.

The `development` profile is defined in `eas.json`.

## Speech recognition

Voice Billing uses [`expo-speech-recognition`](https://www.npmjs.com/package/expo-speech-recognition) (`57.1.1`, Expo SDK 57) with `ta-IN` and `en-IN`. The app requests microphone (and iOS speech) permission, shows partial results, and lets you stop or cancel.

On-device recognition is preferred when the OS reports it as available; otherwise the platform recognizer is used (which may need a network for some locales, especially Tamil). **Test this on a real device.**

To force the scripted mock recognizer (no microphone), start Metro with:

```bash
EXPO_PUBLIC_MOCK_STT=1 npx expo start --dev-client
```

Leave this unset in real device builds.

## Bluetooth ESC/POS printing

Receipts are built in TypeScript (58mm / 80mm) and sent with [`react-native-thermal-printer-driver`](https://www.npmjs.com/package/react-native-thermal-printer-driver) (`0.1.1`). Choose a printer under Settings; use Print on an invoice. Android 12+ needs `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` (declared in `app.json` and requested at runtime).

## Invoice PDFs

A Rule 46-style GST tax invoice is rendered with [`expo-print`](https://www.npmjs.com/package/expo-print) (`~57.0.2`) and shared with `expo-sharing`. Use **PDF** / **Share** on the invoices list, or after creating an invoice.

## Typecheck and tests

```bash
npx tsc --noEmit
npm test
npx expo-doctor
```

## Backend API (dev)

The dev API base URL is `http://10.0.2.2:8000/api/v1` on the Android emulator and `http://localhost:8000/api/v1` elsewhere. Override with `EXPO_PUBLIC_API_URL`. Cleartext HTTP is enabled for debug builds via `expo-build-properties`.
