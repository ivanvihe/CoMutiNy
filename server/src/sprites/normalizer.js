import { PNG } from 'pngjs'
import { normalizePaletteInput, paletteToHex, quantizeToPalette } from './utils/color.js'

const DEFAULT_SIZE = 32

const decodePng = (buffer) => {
  if (!buffer || !(buffer instanceof Uint8Array)) {
    throw new Error('Sprite normalizer requires a PNG buffer')
  }

  return PNG.sync.read(Buffer.from(buffer))
}

const encodePng = (png) => {
  return PNG.sync.write(png)
}

const resizeNearestNeighbor = (source, width, height) => {
  if (source.width === width && source.height === height) {
    return source
  }

  const target = new PNG({ width, height })

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.floor((x / width) * source.width)
      const sourceY = Math.floor((y / height) * source.height)
      const sourceIndex = (sourceY * source.width + sourceX) << 2
      const targetIndex = (y * width + x) << 2

      target.data[targetIndex] = source.data[sourceIndex]
      target.data[targetIndex + 1] = source.data[sourceIndex + 1]
      target.data[targetIndex + 2] = source.data[sourceIndex + 2]
      target.data[targetIndex + 3] = source.data[sourceIndex + 3]
    }
  }

  return target
}

const quantizeImage = (png, palette) => {
  if (!palette) {
    return png
  }

  const target = new PNG({ width: png.width, height: png.height })

  for (let index = 0; index < png.data.length; index += 4) {
    const rgba = [
      png.data[index],
      png.data[index + 1],
      png.data[index + 2],
      png.data[index + 3]
    ]

    if (rgba[3] === 0) {
      target.data[index] = 0
      target.data[index + 1] = 0
      target.data[index + 2] = 0
      target.data[index + 3] = 0
      continue
    }

    const mapped = quantizeToPalette(rgba, palette)

    target.data[index] = mapped[0]
    target.data[index + 1] = mapped[1]
    target.data[index + 2] = mapped[2]
    target.data[index + 3] = mapped[3]
  }

  return target
}

const extractPalette = (png) => {
  const palette = new Map()

  for (let index = 0; index < png.data.length; index += 4) {
    const a = png.data[index + 3]
    if (a === 0) {
      continue
    }

    const key = [
      png.data[index],
      png.data[index + 1],
      png.data[index + 2],
      a
    ].join(',')

    if (!palette.has(key)) {
      palette.set(key, [
        png.data[index],
        png.data[index + 1],
        png.data[index + 2],
        a
      ])
    }
  }

  return Array.from(palette.values())
}

export const normalizeSprite = (buffer, { width, height, palette } = {}) => {
  const decoded = decodePng(buffer)
  const targetWidth = Number.isFinite(width) && width > 0 ? Math.floor(width) : decoded.width || DEFAULT_SIZE
  const targetHeight = Number.isFinite(height) && height > 0 ? Math.floor(height) : decoded.height || DEFAULT_SIZE
  const normalizedPalette = normalizePaletteInput(palette)

  const resized = resizeNearestNeighbor(decoded, targetWidth, targetHeight)
  const quantized = quantizeImage(resized, normalizedPalette)
  const paletteUsed = extractPalette(quantized)

  return {
    buffer: encodePng(quantized),
    width: targetWidth,
    height: targetHeight,
    palette: paletteToHex(paletteUsed),
    paletteRgba: paletteUsed
  }
}

export default normalizeSprite
