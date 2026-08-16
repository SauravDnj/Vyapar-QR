import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

import { AuthService } from './auth.service';

const CONFIG_VALUES: Record<string, string> = {
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '30d',
};

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn<Promise<{ id: string; email: string; role: string }>, [{ data: Record<string, unknown> }]>(),
      update: jest.fn<Promise<unknown>, [{ where: { id: string }; data: Record<string, unknown> }]>(),
      updateMany: jest.fn(),
    },
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => CONFIG_VALUES[key],
            getOrThrow: (key: string) => {
              const value = CONFIG_VALUES[key];
              if (!value) throw new Error(`Missing config: ${key}`);
              return value;
            },
          },
        },
        { provide: EmailService, useValue: { sendPasswordReset: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('creates a client_admin user and returns a token pair on success', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({
        id: 'user-1',
        email: 'new@example.com',
        role: 'client_admin',
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.register('new@example.com', 'Password123!');

      expect(result.user).toEqual({ id: 'user-1', email: 'new@example.com', role: 'client_admin' });
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(prisma.user.create.mock.calls[0]?.[0]).toMatchObject({
        data: { email: 'new@example.com', role: 'client_admin' },
      });
    });

    it('rejects a duplicate email with ConflictException (409)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing', email: 'dupe@example.com' });

      await expect(service.register('dupe@example.com', 'Password123!')).rejects.toMatchObject({
        status: 409,
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('validateCredentials', () => {
    it('returns the user on correct credentials', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@example.com',
        role: 'client_admin',
        status: 'active',
        passwordHash,
      });

      const result = await service.validateCredentials('a@example.com', 'correct-password');
      expect(result).toEqual({ id: 'user-1', email: 'a@example.com', role: 'client_admin' });
    });

    it('rejects a wrong password with UnauthorizedException (401)', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@example.com',
        role: 'client_admin',
        status: 'active',
        passwordHash,
      });

      await expect(service.validateCredentials('a@example.com', 'wrong-password')).rejects.toMatchObject({
        status: 401,
      });
    });

    it('rejects a non-existent user without revealing that it does not exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.validateCredentials('nobody@example.com', 'whatever')).rejects.toMatchObject({
        status: 401,
        message: 'Invalid credentials',
      });
    });

    it('rejects a disabled account even with the correct password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@example.com',
        role: 'client_admin',
        status: 'disabled',
        passwordHash,
      });

      await expect(service.validateCredentials('a@example.com', 'correct-password')).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('refresh', () => {
    it('rejects a malformed/garbage token', async () => {
      await expect(service.refresh('not-a-real-jwt')).rejects.toMatchObject({ status: 401 });
    });

    it('rejects a well-formed token signed with the wrong secret', async () => {
      const jwt = new JwtService();
      const forged = jwt.sign({ sub: 'user-1', email: 'a@example.com', role: 'client_admin' }, { secret: 'attacker-secret' });

      await expect(service.refresh(forged)).rejects.toMatchObject({ status: 401 });
    });

    it('rejects a valid token when the stored refresh hash no longer matches (already rotated/logged out)', async () => {
      const jwt = new JwtService();
      const token = jwt.sign(
        { sub: 'user-1', email: 'a@example.com', role: 'client_admin' },
        { secret: CONFIG_VALUES.JWT_REFRESH_SECRET },
      );
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', hashedRefreshToken: null });

      await expect(service.refresh(token)).rejects.toMatchObject({ status: 401 });
    });

    it('rotates and returns a new token pair for a valid, matching refresh token', async () => {
      const jwt = new JwtService();
      const token = jwt.sign(
        { sub: 'user-1', email: 'a@example.com', role: 'client_admin' },
        { secret: CONFIG_VALUES.JWT_REFRESH_SECRET },
      );
      const hashedRefreshToken = await bcrypt.hash(token, 10);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@example.com',
        role: 'client_admin',
        hashedRefreshToken,
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.refresh(token);
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
    });
  });

  describe('forgotPassword', () => {
    it('does not reveal whether the account exists for an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const result = await service.forgotPassword('unknown@example.com');
      expect(result).toBeNull();
    });

    it('issues a signed reset token for a known email', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', email: 'known@example.com' });
      const result = await service.forgotPassword('known@example.com');
      expect(result).toEqual(expect.any(String));
    });
  });

  describe('resetPassword', () => {
    it('rejects an invalid/garbage token', async () => {
      await expect(service.resetPassword('garbage', 'NewPassword123!')).rejects.toMatchObject({ status: 401 });
    });

    it('rejects a well-formed access token that was not minted for password reset', async () => {
      const jwt = new JwtService();
      const wrongPurposeToken = jwt.sign({ sub: 'user-1', purpose: 'something-else' }, { secret: CONFIG_VALUES.JWT_ACCESS_SECRET });

      await expect(service.resetPassword(wrongPurposeToken, 'NewPassword123!')).rejects.toMatchObject({ status: 401 });
    });

    it('updates the password and clears the refresh token for a valid reset token', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', email: 'known@example.com' });
      const resetToken = await service.forgotPassword('known@example.com');
      prisma.user.update.mockResolvedValue({});

      if (!resetToken) {
        throw new Error('expected forgotPassword to return a reset token for a known user');
      }
      await service.resetPassword(resetToken, 'NewPassword123!');

      expect(prisma.user.update.mock.calls[0]?.[0]).toMatchObject({
        where: { id: 'user-1' },
        data: { hashedRefreshToken: null },
      });
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      await service.logout('user-1');
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { hashedRefreshToken: null },
      });
    });
  });
});
