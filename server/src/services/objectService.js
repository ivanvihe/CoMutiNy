import path from 'node:path'

import { ensureDefinitionsLoaded, getDefinition as getRegistryDefinition } from '../objects/objectRegistry.js'
import {
  ensureObjectDefinitionsLoaded,
  getObjectDefinition
} from '../utils/objectDefinitionLoader.js'

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
    const [registryState, appState] = await Promise.all([
      ensureDefinitionsLoaded(options),
      ensureObjectDefinitionsLoaded(options)
    ])

    const entries = new Map()

    for (const definition of registryState.definitions.values()) {
      if (definition?.id) {
        entries.set(definition.id, definition)
      }
    }

    for (const definition of appState.definitions.values()) {
      if (definition?.id) {
        entries.set(definition.id, definition)
      }
    }

    return Array.from(entries.values())
      .map((definition) => normaliseDefinition(definition))
      .filter(Boolean)
  },

  async getDefinition (objectId, options = {}) {
    if (!objectId) {
      return null
    }

    const [registryDefinition, appDefinition] = await Promise.all([
      (async () => {
        await ensureDefinitionsLoaded(options)
        return getRegistryDefinition(objectId)
      })(),
      getObjectDefinition(objectId, options)
    ])

    const definition = appDefinition ?? registryDefinition
    return normaliseDefinition(definition)
  }
}

export default objectService
