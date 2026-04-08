process.env.EXPO_ROUTER_APP_ROOT = 'app'

const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch the monorepo root so Metro can access root node_modules
config.watchFolders = [workspaceRoot]

// Resolve from mobile app first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Force a single React (19.1.0) for the entire bundle. Metro's default node_modules
// resolution walks up from the requiring file, so react-native (in root node_modules)
// resolves to root's react 19.2.4 while expo-router resolves to apps/mobile's 19.1.0.
// Return the exact filePath to bypass Metro's resolution entirely.
const reactDir = path.resolve(projectRoot, 'node_modules/react')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Bare 'react' import → exact path to local 19.1.0
  if (moduleName === 'react') {
    return { type: 'sourceFile', filePath: path.join(reactDir, 'index.js') }
  }
  // Sub-path imports like react/jsx-runtime, react/jsx-dev-runtime, react/package.json
  if (moduleName.startsWith('react/')) {
    const subPath = moduleName.slice('react/'.length)
    return context.resolveRequest(
      { ...context, originModulePath: path.join(reactDir, 'index.js') },
      './' + subPath,
      platform
    )
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
