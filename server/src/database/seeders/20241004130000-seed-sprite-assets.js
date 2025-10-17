import { randomUUID } from 'crypto'

const spriteAssets = [
  {
    id: randomUUID(),
    name: 'Explorer Base',
    category: 'character',
    image_url: 'https://example.com/sprites/explorer.png',
    metadata: { theme: 'space', frames: 8 },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: randomUUID(),
    name: 'Galaxy Background',
    category: 'environment',
    image_url: 'https://example.com/backgrounds/galaxy.png',
    metadata: { parallax: true },
    created_at: new Date(),
    updated_at: new Date()
  }
]

export const up = async ({ context: queryInterface }) => {
  await queryInterface.bulkInsert('sprite_assets', spriteAssets)
}

export const down = async ({ context: queryInterface }) => {
  const ids = spriteAssets.map((asset) => asset.id)
  await queryInterface.bulkDelete('sprite_assets', { id: ids })
}
