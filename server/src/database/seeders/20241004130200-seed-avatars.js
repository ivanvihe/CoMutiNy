import { randomUUID } from 'crypto'

const now = new Date()

const avatarDefinitions = [
  {
    username: 'commander',
    spriteName: 'Explorer Base',
    name: 'Commander Nova',
    description: 'Leader of the CoMutiNy expedition.'
  },
  {
    username: 'navigator',
    spriteName: 'Explorer Base',
    name: 'Navigator Flux',
    description: 'Charting the cosmos with precision.'
  }
]

export const up = async ({ context: queryInterface }) => {
  const [users] = await queryInterface.sequelize.query(
    'SELECT id, username FROM users WHERE username IN (:usernames)',
    { replacements: { usernames: avatarDefinitions.map((definition) => definition.username) } }
  )

  const [spriteAssets] = await queryInterface.sequelize.query(
    'SELECT id, name FROM sprite_assets WHERE name IN (:names)',
    { replacements: { names: [...new Set(avatarDefinitions.map((definition) => definition.spriteName))] } }
  )

  const userByUsername = Object.fromEntries(users.map((user) => [user.username, user.id]))
  const spriteByName = Object.fromEntries(spriteAssets.map((asset) => [asset.name, asset.id]))

  const avatars = avatarDefinitions.map((definition) => ({
    id: randomUUID(),
    user_id: userByUsername[definition.username],
    sprite_asset_id: spriteByName[definition.spriteName] ?? null,
    name: definition.name,
    description: definition.description,
    created_at: now,
    updated_at: now
  }))

  await queryInterface.bulkInsert('avatars', avatars)
}

export const down = async ({ context: queryInterface }) => {
  await queryInterface.bulkDelete('avatars', {
    name: avatarDefinitions.map((definition) => definition.name)
  })
}
