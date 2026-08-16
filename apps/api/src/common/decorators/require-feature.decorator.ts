import { SetMetadata } from '@nestjs/common';

import type { PlanFeatures } from '@qrhub/types';

export const REQUIRE_FEATURE_KEY = 'requireFeature';
export const RequireFeature = (feature: keyof PlanFeatures) => SetMetadata(REQUIRE_FEATURE_KEY, feature);
