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

// Force a single React (19.1.0) for the entire bundle. The pinned version in
// package.json creates a local copy that matches react-native's renderer.
// Without this override, some imports resolve to root's hoisted react (19.2.4).
const reactDir = path.resolve(projectRoot, 'node_modules/react')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Bare 'react' import → exact path to the single hoisted copy
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
