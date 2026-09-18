// mobile/metro.config.js
// Custom Metro resolver to shim @react-native-voice/voice in Expo Go.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const path = require('path');

// Shim native-only modules so they don't crash in Expo Go / web
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@react-native-voice/voice': path.resolve(__dirname, 'src/voice/voiceMock.ts'),
};

module.exports = config;
