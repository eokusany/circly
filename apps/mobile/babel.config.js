module.exports = function (api) {
  api.cache(true)
  // babel-preset-expo lives in root node_modules and uses require.resolve to detect
  // expo-router, but expo-router is only in apps/mobile/node_modules so hasModule()
  // returns false and the expoRouterBabelPlugin is never added. Add it explicitly.
  const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin')
  return {
    presets: ['babel-preset-expo'],
    plugins: [expoRouterBabelPlugin],
  }
}
