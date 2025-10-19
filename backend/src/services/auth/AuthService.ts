import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { User } from '../../entities';

export interface AuthCredentials {
  identifier: string;
  password: string;
}

export interface RegistrationPayload {
  email: string;
  displayName: string;
  password: string;
}

export interface IAuthService {
  register(payload: RegistrationPayload): Promise<User>;
  validateCredentials(credentials: AuthCredentials): Promise<User | null>;
}

export class AuthService implements IAuthService {
  private static readonly SALT_ROUNDS = 10;

  constructor(private readonly userRepository: Repository<User>) {}

  public async register(payload: RegistrationPayload): Promise<User> {
    const existingUser = await this.userRepository.findOne({ where: { email: payload.email } });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordHash = await this.hashPassword(payload.password);

    const user = this.userRepository.create({
      email: payload.email,
      displayName: payload.displayName,
      passwordHash,
    });

    return this.userRepository.save(user);
  }

  public async validateCredentials(credentials: AuthCredentials): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: [{ email: credentials.identifier }, { displayName: credentials.identifier }],
    });

    if (!user) {
      return null;
    }

    const matches = await bcrypt.compare(credentials.password, user.passwordHash);

    return matches ? user : null;
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, AuthService.SALT_ROUNDS);
  }
}
