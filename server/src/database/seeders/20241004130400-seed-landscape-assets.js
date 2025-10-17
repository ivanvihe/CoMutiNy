import { randomUUID } from 'crypto'

const landscapeAssets = [
  {
    id: randomUUID(),
    name: 'Nebula Vista',
    category: 'space',
    image_url: 'https://example.com/landscapes/nebula.png',
    metadata: { parallax: true, depth: 3 },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: randomUUID(),
    name: 'Cyber Dock',
    category: 'city',
    image_url: 'https://example.com/landscapes/cyber-dock.png',
    metadata: { parallax: false },
    created_at: new Date(),
    updated_at: new Date()
  }
]

export const up = async ({ context: queryInterface }) => {
  await queryInterface.bulkInsert('landscape_assets', landscapeAssets)
}

export const down = async ({ context: queryInterface }) => {
  const ids = landscapeAssets.map((asset) => asset.id)
  await queryInterface.bulkDelete('landscape_assets', { id: ids })
}
