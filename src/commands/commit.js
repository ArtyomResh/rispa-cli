const path = require('path')
const Listr = require('listr')
const Command = require('../Command')
const readProjectConfiguration = require('../tasks/readProjectConfiguration')
const { getChanges: gitGetChanges } = require('../utils/git')
const createCommitAndPushPluginChanges = require('../tasks/commitAndPushPluginChanges')
const createCommitAndPushChanges = require('../tasks/commitAndPushChanges')
const { checkMode } = require('../utils/tasks')
const { DEV_MODE } = require('../constants')

class CommitCommand extends Command {
  constructor(options) {
    super(options)

    this.state = {
      pluginsChanges: [],
      projectChanges: null,
    }

    this.getChanges = this.getChanges.bind(this)
    this.commitPluginsChanges = this.commitPluginsChanges.bind(this)
    this.commitProjectChanges = this.commitProjectChanges.bind(this)
  }

  getChanges(ctx) {
    const { projectPath, configuration } = ctx

    if (checkMode(ctx, DEV_MODE)) {
      const pluginsPath = path.resolve(projectPath, configuration.pluginsPath)

      this.state.pluginsChanges = configuration.plugins
        .map(pluginName => ({
          name: pluginName,
          path: path.resolve(pluginsPath, `./${pluginName}`),
        }))
        .map(plugin => Object.assign(plugin, {
          changes: gitGetChanges(plugin.path),
        }))
        .filter(plugin => !!plugin.changes)
    }

    this.state.projectChanges = gitGetChanges(projectPath)
  }

  commitPluginsChanges() {
    const { pluginsChanges } = this.state

    return new Listr(pluginsChanges.map(createCommitAndPushPluginChanges), { exitOnError: false })
  }

  commitProjectChanges({ projectPath }) {
    const { projectChanges } = this.state

    return createCommitAndPushChanges(projectPath, projectChanges).task()
  }

  init() {
    return [
      readProjectConfiguration,
      {
        title: 'Get changes',
        task: this.getChanges,
      },
      {
        title: 'Commit plugins changes',
        enabled: ctx => checkMode(ctx, DEV_MODE),
        skip: () => this.state.pluginsChanges.length === 0 && 'Can\'t find plugins changes',
        task: this.commitPluginsChanges,
      },
      {
        title: 'Commit project changes',
        skip: () => !this.state.projectChanges && 'Can\'t find project changes',
        task: this.commitProjectChanges,
      },
    ]
  }
}

CommitCommand.commandName = 'commit'
CommitCommand.commandDescription = 'Commit changes'

module.exports = CommitCommand
