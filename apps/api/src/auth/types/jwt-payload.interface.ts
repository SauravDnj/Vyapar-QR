import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Set when this access token was minted by a Super Admin impersonating
   * this user — the id of the impersonating Super Admin's own user record. */
  impersonatedBy?: string;
}
