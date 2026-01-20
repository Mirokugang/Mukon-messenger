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
            assert: 'assert',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
