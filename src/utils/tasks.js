const { isPromise } = require('./promise')
const { DEV_MODE } = require('../constants')

const createTaskWrapper = ({ before, after, task }) => (context, wrapper) => {
  if (before) {
    before(context, wrapper)
  }

  const result = task(context, wrapper)

  if (isPromise(result)) {
    return result.then(() => after && after(context, wrapper))
  }

  if (after) {
    after(context, wrapper)
  }

  return result
}

const improveTask = task => {
  if (!task.wrapped && (task.after || task.before)) {
    return Object.assign({}, task, {
      task: createTaskWrapper(task),
      wrapped: true,
    })
  }

  return task
}

const extendsTask = (task, options) => improveTask(Object.assign({}, task, options))

const checkDevMode = ctx => (ctx.mode || (ctx.configuration && ctx.configuration.mode)) === DEV_MODE

const skipDevMode = ctx => checkDevMode(ctx) && 'Development mode'

module.exports = {
  createTaskWrapper,
  improveTask,
  extendsTask,
  checkDevMode,
  skipDevMode,
}
