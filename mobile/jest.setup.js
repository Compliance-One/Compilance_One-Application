jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);


// The app defaults to Tamil; existing document tests assert English strings.
require('./src/i18n').default.changeLanguage('en');
