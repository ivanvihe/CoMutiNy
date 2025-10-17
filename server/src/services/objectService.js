import path from 'node:path'

import { ensureDefinitionsLoaded, getDefinition } from '../objects/objectRegistry.js'

const normaliseDefinition = (definition) => {
  if (!definition) {
    return null
  }

  const { source, ...rest } = definition
  const sourcePath = typeof source === 'string' ? path.relative(process.cwd(), source) : null

  return {
    ...rest,
    sourcePath
  }
}

const objectService = {
  async listDefinitions (options = {}) {
    const state = await ensureDefinitionsLoaded(options)
    const entries = Array.from(state.definitions.values())
    return entries.map((definition) => normaliseDefinition(definition)).filter(Boolean)
  },

  async getDefinition (objectId, options = {}) {
    if (!objectId) {
      return null
    }

    await ensureDefinitionsLoaded(options)
    const definition = getDefinition(objectId)
    return normaliseDefinition(definition)
  }
}

export default objectService
