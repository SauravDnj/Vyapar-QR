/** Per-staff-member access grants, stored in `ClientStaffMember.permissionsJson`.
 * Checked by `PermissionsGuard` (see `@RequirePermission`) on top of the
 * existing `client_admin`/`client_staff` role check. A `client_admin` is
 * never subject to this — only invited `client_staff` accounts can be
 * restricted. */
export interface StaffPermissions {
  leads: boolean;
  reviews: boolean;
  analytics: boolean;
  billing: boolean;
  domains: boolean;
  whatsapp: boolean;
  menu: boolean;
  orders: boolean;
}

/** Applied when `permissionsJson` is null — every staff member invited
 * before this feature existed keeps the full access it always had. */
export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  leads: true,
  reviews: true,
  analytics: true,
  billing: true,
  domains: true,
  whatsapp: true,
  menu: true,
  orders: true,
};
