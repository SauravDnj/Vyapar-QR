import { SetMetadata } from '@nestjs/common';

import type { StaffPermissions } from '@qrhub/types';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const RequirePermission = (permission: keyof StaffPermissions) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
