import sequelize from '../../config/database.js'
import defineUser from './user.js'
import defineAvatar from './avatar.js'
import defineMessage from './message.js'
import defineSpriteAsset from './spriteAsset.js'
import defineLandscapeAsset from './landscapeAsset.js'

const User = defineUser(sequelize)
const Avatar = defineAvatar(sequelize)
const Message = defineMessage(sequelize)
const SpriteAsset = defineSpriteAsset(sequelize)
const LandscapeAsset = defineLandscapeAsset(sequelize)

User.hasMany(Avatar, {
  as: 'avatars',
  foreignKey: 'userId',
  onDelete: 'CASCADE'
})
Avatar.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId'
})

SpriteAsset.hasMany(Avatar, {
  as: 'avatars',
  foreignKey: 'spriteAssetId'
})
Avatar.belongsTo(SpriteAsset, {
  as: 'spriteAsset',
  foreignKey: 'spriteAssetId'
})

User.hasMany(Message, {
  as: 'messages',
  foreignKey: 'userId',
  onDelete: 'CASCADE'
})
Message.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId'
})

Avatar.hasMany(Message, {
  as: 'messages',
  foreignKey: 'avatarId',
  onDelete: 'SET NULL'
})
Message.belongsTo(Avatar, {
  as: 'avatar',
  foreignKey: 'avatarId'
})

export { sequelize, User, Avatar, Message, SpriteAsset, LandscapeAsset }

export default {
  sequelize,
  User,
  Avatar,
  Message,
  SpriteAsset,
  LandscapeAsset
}
