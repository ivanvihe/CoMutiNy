const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)))

export const hexToRgba = (hex) => {
  if (typeof hex !== 'string') {
    return null
  }

  const normalized = hex.trim().replace(/^#/, '')

  if (![3, 4, 6, 8].includes(normalized.length)) {
    return null
  }

  const expand = (value) => (value.length === 1 ? value.repeat(2) : value)

  if (normalized.length <= 4) {
    const [r, g, b, a = 'f'] = normalized.split('').map(expand)
    return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), parseInt(a, 16)]
  }

  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  const a = normalized.length === 8 ? parseInt(normalized.slice(6, 8), 16) : 255

  return [r, g, b, a]
}

export const rgbaToHex = ([r, g, b, a = 255]) => {
  const channels = [r, g, b, a].map((channel, index) => {
    const value = clampChannel(channel)
    return value.toString(16).padStart(2, '0')
  })

  if (channels[3] === 'ff') {
    channels.pop()
  }

  return `#${channels.join('')}`
}

const squaredDistance = (source, target) => {
  let distance = 0

  for (let index = 0; index < 4; index += 1) {
    const sourceChannel = source[index] ?? 0
    const targetChannel = target[index] ?? 0
    const delta = sourceChannel - targetChannel
    distance += delta * delta
  }

  return distance
}

export const quantizeToPalette = (rgba, palette) => {
  if (!Array.isArray(palette) || palette.length === 0) {
    return rgba
  }

  let closest = palette[0]
  let minDistance = squaredDistance(rgba, closest)

  for (let index = 1; index < palette.length; index += 1) {
    const color = palette[index]
    const distance = squaredDistance(rgba, color)

    if (distance < minDistance) {
      closest = color
      minDistance = distance
    }
  }

  return closest
}

export const normalizePaletteInput = (palette) => {
  if (!Array.isArray(palette)) {
    return null
  }

  const normalized = palette
    .map((color) => {
      if (Array.isArray(color) && (color.length === 3 || color.length === 4)) {
        const channels = [...color]
        if (channels.length === 3) {
          channels.push(255)
        }
        return channels.map((channel, index) => clampChannel(channel))
      }

      const rgba = hexToRgba(color)
      if (!rgba) {
        return null
      }

      if (rgba.length === 3) {
        rgba.push(255)
      }

      return rgba
    })
    .filter(Boolean)

  return normalized.length ? normalized : null
}

export const paletteToHex = (palette) => {
  if (!Array.isArray(palette)) {
    return []
  }

  return palette.map((color) => rgbaToHex(color))
}

export default {
  hexToRgba,
  rgbaToHex,
  quantizeToPalette,
  normalizePaletteInput,
  paletteToHex
}
