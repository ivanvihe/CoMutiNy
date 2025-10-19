import bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';

import { User } from '../../entities';

const DEFAULT_ADMIN_DISPLAY_NAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'com-21';
const SALT_ROUNDS = 10;

export const ensureDefaultAdmin = async (userRepository: Repository<User>): Promise<User> => {
  const existingAdmin = await userRepository.findOne({ where: { isAdmin: true } });

  if (existingAdmin) {
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);

  const adminUser = userRepository.create({
    email: null,
    displayName: DEFAULT_ADMIN_DISPLAY_NAME,
    isAdmin: true,
    passwordHash,
  });

  return userRepository.save(adminUser);
};
