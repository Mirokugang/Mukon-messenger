module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            stream: 'readable-stream',
            buffer: '@craftzdog/react-native-buffer',
            assert: 'assert',
          },
        },
      ],
    ],
  };
};
