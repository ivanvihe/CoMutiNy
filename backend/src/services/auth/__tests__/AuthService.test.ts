import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { User } from '../../../entities';
import { AuthService, RegistrationPayload } from '../AuthService';

jest.mock('bcrypt');

describe('AuthService', () => {
  let userRepository: jest.Mocked<Repository<User>>;
  let service: AuthService;
  let payload: RegistrationPayload;

  beforeEach(() => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    service = new AuthService(userRepository);

    payload = {
      email: 'player@example.com',
      displayName: 'Player One',
      password: 'super-secret',
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('register', () => {
    it('stores a new user when the email is unused', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const user = new User();
      userRepository.create.mockReturnValue(user);
      userRepository.save.mockResolvedValue(user);

      const result = await service.register(payload);

      expect(userRepository.create).toHaveBeenCalledWith({
        email: payload.email,
        displayName: payload.displayName,
        passwordHash: 'hashed-password',
      });
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result).toBe(user);
    });

    it('throws when the email already exists', async () => {
      userRepository.findOne.mockResolvedValue(new User());

      await expect(service.register(payload)).rejects.toThrow('Email already registered');
    });
  });

  describe('validateCredentials', () => {
    it('returns null when the user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateCredentials({
        email: payload.email,
        password: payload.password,
      });

      expect(result).toBeNull();
    });

    it('returns null when the password does not match', async () => {
      const user = new User();
      user.passwordHash = 'stored-hash';
      userRepository.findOne.mockResolvedValue(user);

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateCredentials({
        email: payload.email,
        password: payload.password,
      });

      expect(result).toBeNull();
    });

    it('returns the user when the password matches', async () => {
      const user = new User();
      user.passwordHash = 'stored-hash';
      userRepository.findOne.mockResolvedValue(user);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateCredentials({
        email: payload.email,
        password: payload.password,
      });

      expect(result).toBe(user);
    });
  });
});
