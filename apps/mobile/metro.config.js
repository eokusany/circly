const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

// expo-router v6 requires EXPO_ROUTER_APP_ROOT to be set before the
// bundle is built so require.context resolves to a static string.
process.env.EXPO_ROUTER_APP_ROOT = path.resolve(__dirname, 'app')

const config = getDefaultConfig(__dirname)

module.exports = config
