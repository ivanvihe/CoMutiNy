const DEFAULT_SIZE = 256

const deriveSize = ({ width, height }) => {
  const normalizedWidth = Number.isFinite(width) ? Math.max(64, Math.min(1024, Math.floor(width))) : DEFAULT_SIZE
  const normalizedHeight = Number.isFinite(height) ? Math.max(64, Math.min(1024, Math.floor(height))) : DEFAULT_SIZE
  const clamped = Math.min(normalizedWidth, normalizedHeight)

  // DALL·E 2 only accepts square sizes: 256, 512, 1024
  if (clamped <= 256) {
    return 256
  }

  if (clamped <= 512) {
    return 512
  }

  return 1024
}

class DalleGenerator {
  constructor () {
    this.name = 'dall-e'
    this.endpoint = 'https://api.openai.com/v1/images/generations'
  }

  isAvailable () {
    return Boolean(process.env.OPENAI_API_KEY)
  }

  async generate ({ description, width, height } = {}) {
    if (!this.isAvailable()) {
      throw new Error('OPENAI_API_KEY is not configured. Cannot use DALL·E generator.')
    }

    if (typeof description !== 'string' || !description.trim()) {
      throw new Error('A description is required to generate images with DALL·E')
    }

    const size = deriveSize({ width, height })

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: description,
        n: 1,
        size: `${size}x${size}`,
        response_format: 'b64_json'
      })
    })

    if (!response.ok) {
      let message = `DALL·E request failed with status ${response.status}`
      try {
        const errorPayload = await response.json()
        message = errorPayload?.error?.message ?? message
      } catch (_) {
        // ignore JSON parse errors
      }

      throw new Error(message)
    }

    const payload = await response.json()
    const image = payload?.data?.[0]?.b64_json

    if (!image) {
      throw new Error('DALL·E response did not include an image payload')
    }

    const buffer = Buffer.from(image, 'base64')

    return {
      buffer,
      width: size,
      height: size,
      metadata: {
        generator: this.name,
        provider: 'openai',
        size,
        description,
        apiModel: payload?.model ?? 'dall-e-2',
        revisedPrompt: payload?.data?.[0]?.revised_prompt ?? null
      }
    }
  }
}

const generator = new DalleGenerator()

export default generator
