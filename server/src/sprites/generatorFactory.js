import proceduralGenerator from './generators/proceduralPixelArtGenerator.js'
import dalleGenerator from './generators/dalleGenerator.js'
import stableDiffusionGenerator from './generators/stableDiffusionGenerator.js'

const generators = new Map([
  ['procedural', proceduralGenerator],
  ['dall-e', dalleGenerator],
  ['stable-diffusion', stableDiffusionGenerator]
])

export const listGenerators = () => {
  return Array.from(generators.entries()).map(([key, generator]) => ({
    id: key,
    name: generator.name ?? key,
    available: typeof generator.isAvailable === 'function' ? generator.isAvailable() : true
  }))
}

export const getGenerator = (id = 'procedural') => {
  const key = typeof id === 'string' ? id.toLowerCase() : 'procedural'
  return generators.get(key) ?? generators.get('procedural')
}

export default {
  listGenerators,
  getGenerator
}
