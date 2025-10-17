import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import spriteAssetRepository from '../repositories/SpriteAssetRepository.js'
import { normalizeSprite } from './normalizer.js'
import buildSpriteSheet from './spriteSheetBuilder.js'
import { getGenerator, listGenerators } from './generatorFactory.js'
import { appendSpriteToManifest, buildAtlasSnapshot, ensureSpriteDirectory, loadSpriteManifest } from './spriteAtlasStore.js'
import spriteEvents, { SPRITE_EVENTS } from './events.js'
import slugify from './utils/slugify.js'

const SPRITES_DIR = path.resolve(process.cwd(), 'server', 'assets', 'sprites')

const toPlain = (record) => (typeof record?.get === 'function' ? record.get({ plain: true }) : { ...record })

const toPosixPath = (value) => value.split(path.sep).join('/')

const DEFAULT_CATEGORY = 'generated'
const DEFAULT_NAME = 'Sprite generado'

class SpriteGenerationService {
  constructor ({ repository = spriteAssetRepository } = {}) {
    this.repository = repository
  }

  listAvailableGenerators () {
    return listGenerators()
  }

  async getAtlasSnapshot () {
    const manifest = await loadSpriteManifest()
    return buildAtlasSnapshot(manifest)
  }

  async generateSprite ({
    description,
    generator: generatorId = 'procedural',
    width,
    height,
    palette,
    frames = 1,
    name,
    category,
    metadata: metadataOverrides,
    stylePreset
  } = {}) {
    if (typeof description !== 'string' || !description.trim()) {
      throw new Error('description is required to generate a sprite')
    }

    await ensureSpriteDirectory()

    const warnings = []
    const requestedGenerator = getGenerator(generatorId)
    let generatorUsed = requestedGenerator

    const tryGenerate = async (generator) => {
      const result = await generator.generate({ description, width, height, palette, frames, stylePreset })
      return { result, generator }
    }

    let generation
    try {
      generation = await tryGenerate(requestedGenerator)
    } catch (error) {
      warnings.push(error.message ?? 'No se pudo generar el sprite con el generador solicitado.')
      if (requestedGenerator !== getGenerator('procedural')) {
        const fallback = getGenerator('procedural')
        generation = await tryGenerate(fallback)
        generatorUsed = fallback
      } else {
        throw error
      }
    }

    const normalized = normalizeSprite(generation.result.buffer, {
      width,
      height,
      palette
    })

    const sheet = buildSpriteSheet({
      frames,
      frameWidth: normalized.width,
      frameHeight: normalized.height,
      frameBuffers: [normalized.buffer]
    })

    const spriteId = randomUUID()
    const safeName = typeof name === 'string' && name.trim() ? name.trim() : `${DEFAULT_NAME} ${spriteId.slice(0, 8)}`
    const safeCategory = typeof category === 'string' && category.trim() ? category.trim() : DEFAULT_CATEGORY
    const directoryName = `${slugify(safeName)}-${spriteId.slice(0, 8)}`
    const outputDir = path.join(SPRITES_DIR, directoryName)

    await fs.mkdir(outputDir, { recursive: true })

    const imageFileName = 'sprite.png'
    const metadataFileName = 'metadata.json'
    const imagePath = path.join(outputDir, imageFileName)
    const metadataPath = path.join(outputDir, metadataFileName)
    const createdAt = new Date().toISOString()

    const combinedMetadata = {
      ...generation.result.metadata,
      normalized: {
        width: normalized.width,
        height: normalized.height,
        palette: normalized.palette
      },
      sheet: {
        frames: sheet.frames,
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight
      },
      generator: generatorUsed?.name ?? generatorId,
      description,
      spriteId,
      createdAt
    }

    if (warnings.length) {
      combinedMetadata.warnings = warnings
    }

    if (metadataOverrides && typeof metadataOverrides === 'object') {
      Object.assign(combinedMetadata, metadataOverrides)
    }

    await fs.writeFile(imagePath, sheet.buffer)
    await fs.writeFile(metadataPath, JSON.stringify(combinedMetadata, null, 2), 'utf8')

    const relativeDir = toPosixPath(path.relative(path.join(process.cwd(), 'server', 'assets'), outputDir))
    const imageUrl = `/static/${toPosixPath(path.join(relativeDir, imageFileName))}`
    const metadataUrl = `/static/${toPosixPath(path.join(relativeDir, metadataFileName))}`

    const assetRecord = await this.repository.create({
      name: safeName,
      category: safeCategory,
      imageUrl,
      metadata: combinedMetadata
    })

    const atlasEntry = {
      id: spriteId,
      name: safeName,
      category: safeCategory,
      imageUrl,
      metadata: combinedMetadata,
      createdAt,
      description,
      generator: combinedMetadata.generator,
      resources: {
        image: imageUrl,
        metadata: metadataUrl
      }
    }

    const atlas = await appendSpriteToManifest(atlasEntry)

    spriteEvents.emit(SPRITE_EVENTS.ATLAS_UPDATED, atlas)

    return {
      asset: toPlain(assetRecord),
      atlas,
      warnings,
      resources: {
        image: imageUrl,
        metadata: metadataUrl,
        directory: `/static/${relativeDir}`
      }
    }
  }
}

const spriteGenerationService = new SpriteGenerationService()

export default spriteGenerationService
