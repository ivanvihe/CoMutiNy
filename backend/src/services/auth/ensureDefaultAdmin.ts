import bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';

import { User } from '../../entities';

const SALT_ROUNDS = 10;

const resolveDefaultDisplayName = (): string => {
  const displayName = process.env.DEFAULT_ADMIN_DISPLAY_NAME?.trim();

  return displayName && displayName.length > 0 ? displayName : 'admin';
};

const resolveDefaultPassword = (): string => {
  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (password && password.length > 0) {
    return password;
  }

  return 'com-21';
};

export const ensureDefaultAdmin = async (userRepository: Repository<User>): Promise<User> => {
  const existingAdmin = await userRepository.findOne({ where: { isAdmin: true } });

  if (existingAdmin) {
    return existingAdmin;
  }

  const displayName = resolveDefaultDisplayName();
  const passwordHash = await bcrypt.hash(resolveDefaultPassword(), SALT_ROUNDS);

  const adminUser = userRepository.create({
    email: null,
    displayName,
    isAdmin: true,
    passwordHash,
  });

  return userRepository.save(adminUser);
};
