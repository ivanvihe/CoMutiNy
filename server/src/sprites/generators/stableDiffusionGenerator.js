const DEFAULT_WIDTH = 512
const DEFAULT_HEIGHT = 512

const clampDimension = (value, fallback) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(128, Math.min(1024, Math.floor(parsed)))
}

class StableDiffusionGenerator {
  constructor () {
    this.name = 'stable-diffusion'
    this.endpoint = 'https://api.stability.ai/v2beta/stable-image/generate/core'
  }

  isAvailable () {
    return Boolean(process.env.STABILITY_API_KEY)
  }

  async generate ({ description, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, stylePreset = 'pixel-art' } = {}) {
    if (!this.isAvailable()) {
      throw new Error('STABILITY_API_KEY is not configured. Cannot use Stable Diffusion generator.')
    }

    if (typeof description !== 'string' || !description.trim()) {
      throw new Error('A description is required to generate images with Stable Diffusion')
    }

    const targetWidth = clampDimension(width, DEFAULT_WIDTH)
    const targetHeight = clampDimension(height, DEFAULT_HEIGHT)
    const formData = new FormData()

    formData.append('prompt', description)
    formData.append('output_format', 'png')
    formData.append('style_preset', stylePreset)
    formData.append('image_dimensions', `${targetWidth}x${targetHeight}`)

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STABILITY_API_KEY}`
      },
      body: formData
    })

    if (!response.ok) {
      let message = `Stable Diffusion request failed with status ${response.status}`
      try {
        const errorPayload = await response.json()
        message = errorPayload?.message ?? message
      } catch (_) {
        // ignore JSON parse errors
      }

      throw new Error(message)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return {
      buffer,
      width: targetWidth,
      height: targetHeight,
      metadata: {
        generator: this.name,
        provider: 'stability.ai',
        stylePreset,
        description
      }
    }
  }
}

const generator = new StableDiffusionGenerator()

export default generator
