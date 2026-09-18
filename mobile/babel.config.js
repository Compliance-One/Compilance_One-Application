module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@db': './src/db',
            '@screens': './src/screens',
            '@components': './src/components',
            '@store': './src/store',
            '@voice': './src/voice',
            '@api': './src/api',
            '@sync': './src/sync',
            '@printer': './src/printer',
            '@gstr1': './src/gstr1',
            '@i18n': './src/i18n',
          },
        },
      ],
    ],
  };
};
