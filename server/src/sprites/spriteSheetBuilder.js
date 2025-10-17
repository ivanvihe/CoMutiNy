import { PNG } from 'pngjs'

const DEFAULT_FRAME_COUNT = 1

export const buildSpriteSheet = ({
  frames = DEFAULT_FRAME_COUNT,
  frameWidth,
  frameHeight,
  frameBuffers
}) => {
  if (!Array.isArray(frameBuffers) || frameBuffers.length === 0) {
    throw new Error('frameBuffers must include at least one PNG buffer')
  }

  const normalizedFrames = frameBuffers.map((buffer) => PNG.sync.read(buffer))
  const width = Number.isFinite(frameWidth) ? Math.floor(frameWidth) : normalizedFrames[0].width
  const height = Number.isFinite(frameHeight) ? Math.floor(frameHeight) : normalizedFrames[0].height
  const frameCount = Math.max(frames, normalizedFrames.length)
  const canvas = new PNG({ width: width * frameCount, height })

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const source = normalizedFrames[Math.min(frameIndex, normalizedFrames.length - 1)]

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceIndex = (y * source.width + x) << 2
        const targetIndex = (y * canvas.width + x + frameIndex * width) << 2

        canvas.data[targetIndex] = source.data[sourceIndex]
        canvas.data[targetIndex + 1] = source.data[sourceIndex + 1]
        canvas.data[targetIndex + 2] = source.data[sourceIndex + 2]
        canvas.data[targetIndex + 3] = source.data[sourceIndex + 3]
      }
    }
  }

  return {
    buffer: PNG.sync.write(canvas),
    width: canvas.width,
    height: canvas.height,
    frameWidth: width,
    frameHeight: height,
    frames: frameCount
  }
}

export default buildSpriteSheet
