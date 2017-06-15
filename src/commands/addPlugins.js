const path = require('path')
const { prompt } = require('inquirer')

const { handleError } = require('../core')
const {
  readConfiguration,
  saveConfiguration,
 } = require('../project')
const githubApi = require('../githubApi')
const { installPlugins } = require('../plugin')

const selectPlugins = plugins => prompt([{
  type: 'checkbox',
  message: 'Select install plugins:',
  name: 'installPluginsNames',
  choices: plugins,
}])

const updateConfiguration = (configuration, plugins, projectPath) => {
  const newPlugins = Array.from(configuration.plugins || [])
  const newRemotes = Object.assign({}, configuration.remotes || {})
  plugins.forEach(plugin => {
    newPlugins.push(plugin.name)
    newRemotes[plugin.name] = plugin.clone_url
  })
  saveConfiguration(Object.assign({}, configuration, {
    remotes: newRemotes,
    plugins: newPlugins,
  }), projectPath)
}

const selectAvailablePlugins = async installedPluginsNames => {
  const { data: { items: plugins } } = await githubApi.plugins()

  const pluginsForChoice = plugins.filter(
    ({ name }) => installedPluginsNames.indexOf(name) === -1
  )
  if (pluginsForChoice.length === 0) {
    handleError('Can\'t find plugins for install')
  }

  const { installPluginsNames } = await selectPlugins(pluginsForChoice)

  return plugins.filter(({ name }) => installPluginsNames.indexOf(name) !== -1)
}

const getPluginsFromAvailableList = async pluginsNames => {
  const { data: { items: plugins } } = await githubApi.plugins()

  const notValidPluginsNames = []
  const pluginsToInstall = pluginsNames.map(pluginName => {
    const plugin = plugins.filter(({ name }) => name === pluginName)[0]
    if (!plugin) {
      notValidPluginsNames.push(pluginsNames)
    }
    return plugin
  })

  if (notValidPluginsNames.length > 0) {
    handleError(`Can't find plugins with names:\n - ${notValidPluginsNames.join(', ')}`)
  }

  return pluginsToInstall
}

const extractPluginNameFromUrl = cloneUrl => {
  const parts = cloneUrl.split('/')
  return parts[parts.length - 1].replace(/\.git$/, '')
}

const getPluginsByUrl = clonePluginUrl => {
  if (!clonePluginUrl.endsWith('.git')) {
    handleError(`Invalid plugin git url: ${clonePluginUrl}`)
  }

  return [{
    name: extractPluginNameFromUrl(clonePluginUrl),
    clone_url: clonePluginUrl,
  }]
}

const extractCloneUrl = pluginName => (
  pluginName && pluginName.startsWith('git:') ?
    pluginName.replace(/^git:/, '') : null
)

const addPlugins = async (...pluginsNames) => {
  const projectPath = process.cwd()
  const configuration = readConfiguration(projectPath)

  if (!configuration) {
    handleError('Can\'t find rispa project config')
  }

  const {
    mode,
    plugins: installedPluginsNames = [],
    pluginsPath: relPluginsPath = './packages',
  } = configuration
  const pluginsPath = path.resolve(projectPath, relPluginsPath)

  let pluginsToInstall

  if (pluginsNames.length) {
    const clonePluginUrl = extractCloneUrl(pluginsNames[0])
    pluginsToInstall = (clonePluginUrl
      ? getPluginsByUrl(clonePluginUrl)
      : await getPluginsFromAvailableList(pluginsNames)
    ).filter(({ name }) => {
      if (installedPluginsNames.indexOf(name) !== -1) {
        console.log(`Plugin '${name}' already installed`)
        return false
      }
      return true
    })
  } else {
    pluginsToInstall = await selectAvailablePlugins(installedPluginsNames)
  }

  installPlugins(pluginsToInstall, pluginsPath, mode)

  updateConfiguration(configuration, pluginsToInstall, projectPath)

  process.exit(1)
}

module.exports = addPlugins
