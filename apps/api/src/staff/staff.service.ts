import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

import type { AuthUser } from '../auth/auth.service';
import type { ClientStaffMember, Prisma } from '@prisma/client';
import type { StaffPermissions } from '@qrhub/types';

const STAFF_INVITE_PURPOSE = 'staff_invite';
const BCRYPT_ROUNDS = 10;

interface InvitePayload {
  sub: string;
  email: string;
  purpose: string;
}

export interface InviteResult {
  member: ClientStaffMember;
  /** Always returned (unlike password-reset's token) — the inviter is
   * already an authenticated client_admin choosing who to invite, so
   * there's no email-enumeration concern in handing back a shareable
   * link, and it's the only way to deliver the invite without SMTP. */
  inviteUrl: string;
}

/** P4-01: `client_staff` accounts, invited by a `client_admin` onto their
 * own Client. Mirrors `AuthService`'s signed-JWT-token pattern (see
 * `forgotPassword`/`resetPassword`) rather than a DB-stored token. */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  list(clientId: string): Promise<ClientStaffMember[]> {
    return this.prisma.clientStaffMember.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
  }

  async invite(clientId: string, email: string, permissions?: StaffPermissions): Promise<InviteResult> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { businessName: true } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('That email already has an account.');
    }

    const existingInvite = await this.prisma.clientStaffMember.findFirst({
      where: { clientId, invitedEmail: email, status: 'invited' },
    });
    const member =
      existingInvite ??
      (await this.prisma.clientStaffMember.create({
        data: { clientId, invitedEmail: email, permissionsJson: permissions as unknown as Prisma.InputJsonValue | undefined },
      }));

    const token = this.jwtService.sign(
      { sub: member.id, email, purpose: STAFF_INVITE_PURPOSE },
      { secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '7d' },
    );

    const adminAppUrl = this.configService.get<string>('ADMIN_APP_URL') ?? 'http://localhost:3001';
    const inviteUrl = `${adminAppUrl}/accept-invite?token=${token}`;
    await this.emailService.sendStaffInvite(email, client.businessName, inviteUrl);

    return { member, inviteUrl };
  }

  async remove(clientId: string, memberId: string): Promise<void> {
    const member = await this.prisma.clientStaffMember.findFirst({ where: { id: memberId, clientId } });
    if (!member) {
      throw new NotFoundException('Staff member not found');
    }
    await this.prisma.clientStaffMember.delete({ where: { id: memberId } });
  }

  async updatePermissions(clientId: string, memberId: string, permissions: StaffPermissions): Promise<ClientStaffMember> {
    const member = await this.prisma.clientStaffMember.findFirst({ where: { id: memberId, clientId } });
    if (!member) {
      throw new NotFoundException('Staff member not found');
    }
    return this.prisma.clientStaffMember.update({
      where: { id: memberId },
      data: { permissionsJson: permissions as unknown as Prisma.InputJsonValue },
    });
  }

  async acceptInvite(token: string, password: string): Promise<AuthUser> {
    let payload: InvitePayload;
    try {
      payload = this.jwtService.verify<InvitePayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired invite');
    }
    if (payload.purpose !== STAFF_INVITE_PURPOSE) {
      throw new UnauthorizedException('Invalid invite token');
    }

    const member = await this.prisma.clientStaffMember.findUnique({ where: { id: payload.sub } });
    if (!member || member.status === 'active') {
      throw new UnauthorizedException('This invite is no longer valid');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: payload.email, passwordHash, role: 'client_staff', status: 'active' },
    });
    await this.prisma.clientStaffMember.update({ where: { id: member.id }, data: { userId: user.id, status: 'active' } });

    return { id: user.id, email: user.email, role: user.role };
  }
}
