/** The shape stored in `Plan.featuresJson`. Written by the Super Admin plan
 * form, read by `PlanFeatureGuard` to gate plan-locked endpoints. */
export interface PlanFeatures {
  analytics: boolean;
  customDomain: boolean;
  /** Hides the "Powered by Vyapar QR" landing-page footer line (P4-03). */
  whiteLabel: boolean;
  /** Digital menu + WhatsApp ordering (menu CRUD, public ordering, Orders CRM). */
  digitalMenu: boolean;
}
