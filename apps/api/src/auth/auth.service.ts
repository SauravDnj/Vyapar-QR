import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';


import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

import type { JwtPayload } from './types/jwt-payload.interface';
import type ms from 'ms';

const PASSWORD_RESET_PURPOSE = 'password_reset';
const BCRYPT_ROUNDS = 10;

export interface AuthUser {
  id: string;
  email: string;
  role: 'super_admin' | 'client_admin' | 'client_staff' | 'agency_admin';
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'agency'
  );
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(email: string, password: string): Promise<{ user: AuthUser } & TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, role: 'client_admin' },
    });

    const tokens = await this.issueTokens(user);
    return { user: { id: user.id, email: user.email, role: user.role }, ...tokens };
  }

  /** P4-05: creates an `agency_admin` account plus its `Agency` row (starts
   * `pending` — a Super Admin must approve it before its referral slug can
   * be used at client signup, see `AgenciesService.transition`). */
  async registerAgency(email: string, password: string, name: string): Promise<{ user: AuthUser } & TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const base = slugify(name);
    let slug = base;
    let suffix = 2;
    while (await this.prisma.agency.findUnique({ where: { slug } })) {
      slug = `${base}-${String(suffix)}`;
      suffix += 1;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'agency_admin',
        agency: { create: { name, slug } },
      },
    });

    const tokens = await this.issueTokens(user);
    return { user: { id: user.id, email: user.email, role: user.role }, ...tokens };
  }

  async validateCredentials(email: string, password: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { id: user.id, email: user.email, role: user.role };
  }

  async login(user: AuthUser): Promise<{ user: AuthUser } & TokenPair> {
    const tokens = await this.issueTokens(user);
    return { user, ...tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.hashedRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens({ id: user.id, email: user.email, role: user.role });
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
  }

  async forgotPassword(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Do not reveal account existence to the caller.
      return null;
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, purpose: PASSWORD_RESET_PURPOSE },
      { secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' },
    );

    const adminAppUrl = this.configService.get<string>('ADMIN_APP_URL') ?? 'http://localhost:3001';
    await this.emailService.sendPasswordReset(email, `${adminAppUrl}/reset-password?token=${resetToken}`);

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (payload.purpose !== PASSWORD_RESET_PURPOSE) {
      throw new UnauthorizedException('Invalid reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash, hashedRefreshToken: null },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, hashedRefreshToken: null },
    });
  }

  private async issueTokens(user: AuthUser): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as ms.StringValue,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d') as ms.StringValue,
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }
}
