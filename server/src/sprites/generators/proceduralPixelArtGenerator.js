import { PNG } from 'pngjs'
import { normalizePaletteInput, paletteToHex } from '../utils/color.js'

const DEFAULT_SIZE = 32
const DEFAULT_PALETTE = [
  '#0f0f0f',
  '#ffffff',
  '#ff6b6b',
  '#ffd93d',
  '#6bcfff',
  '#51cf66',
  '#845ef7',
  '#f06595'
]

const hashString = (value) => {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash) + 1
}

const createRng = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

const selectPalette = (rng, requestedPalette) => {
  const normalized = normalizePaletteInput(requestedPalette)

  if (normalized && normalized.length >= 2) {
    return normalized
  }

  const base = normalizePaletteInput(DEFAULT_PALETTE)
  const accentCount = 3
  const palette = [base[0], base[1]]

  while (palette.length < accentCount + 2) {
    const candidate = base[Math.floor(rng() * base.length)]
    if (!palette.some((color) => color.every((channel, index) => channel === candidate[index]))) {
      palette.push(candidate)
    }
  }

  return palette
}

const drawProceduralSprite = (description, { width, height, palette }) => {
  const seed = hashString(description ?? 'sprite')
  const rng = createRng(seed)
  const size = Math.max(width, height, DEFAULT_SIZE)
  const canvas = new PNG({ width: size, height: size })
  const selectedPalette = selectPalette(rng, palette)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < Math.ceil(size / 2); x += 1) {
      const color = selectedPalette[Math.floor(rng() * selectedPalette.length)]
      const intensity = rng()
      const alpha = intensity > 0.2 ? 255 : 0
      const [r, g, b] = color

      const indices = [
        (y * size + x) << 2,
        (y * size + (size - x - 1)) << 2
      ]

      for (const index of indices) {
        canvas.data[index] = r
        canvas.data[index + 1] = g
        canvas.data[index + 2] = b
        canvas.data[index + 3] = alpha
      }
    }
  }

  return {
    buffer: PNG.sync.write(canvas),
    width: size,
    height: size,
    palette: paletteToHex(selectedPalette),
    paletteRgba: selectedPalette
  }
}

class ProceduralPixelArtGenerator {
  constructor () {
    this.name = 'procedural'
  }

  async generate ({ description, width = DEFAULT_SIZE, height = DEFAULT_SIZE, palette } = {}) {
    const result = drawProceduralSprite(description ?? 'sprite', { width, height, palette })

    return {
      buffer: result.buffer,
      width: result.width,
      height: result.height,
      metadata: {
        generator: this.name,
        strategy: 'symmetry-noise',
        palette: result.palette,
        description: description ?? null
      }
    }
  }
}

const generator = new ProceduralPixelArtGenerator()

export default generator
