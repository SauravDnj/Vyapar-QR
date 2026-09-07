import { THEME_BY_NAME } from '@qrhub/types';

import { AcademyTheme } from './academy';
import { ApertureTheme } from './aperture';
import { BoldTheme } from './bold';
import { ElegantTheme } from './elegant';
import { ExecutiveTheme } from './executive';
import { IroncladTheme } from './ironclad';
import { MinimalTheme } from './minimal';
import { NestTheme } from './nest';
import { SereneTheme } from './serene';
import { SpiceTheme } from './spice';
import { StorefrontTheme } from './storefront';
import { TokenTheme } from './token-theme';
import { TrustlineTheme } from './trustline';
import { VitalityTheme } from './vitality';


import type { ThemeRenderProps } from '@qrhub/types';

/** The thirteen original bespoke themes, matched by their database `name`. */
const BESPOKE: Record<string, (props: ThemeRenderProps) => React.JSX.Element> = {
  Academy: AcademyTheme,
  Aperture: ApertureTheme,
  Bold: BoldTheme,
  Elegant: ElegantTheme,
  Executive: ExecutiveTheme,
  Ironclad: IroncladTheme,
  Minimal: MinimalTheme,
  Nest: NestTheme,
  Serene: SereneTheme,
  Spice: SpiceTheme,
  Storefront: StorefrontTheme,
  Trustline: TrustlineTheme,
  Vitality: VitalityTheme,
};

/**
 * Renders the theme a client has selected, by its `name` as stored in the
 * database.
 *
 * Two generations coexist. The original thirteen are bespoke React components
 * and are matched **first**, so a client already using one keeps exactly the
 * page they published — a name that exists in both generations must not
 * silently redesign a live business's card. Everything else resolves from the
 * token catalog, where a theme is data rather than code, which is what makes a
 * hundred-plus of them maintainable. A name in neither falls back to Minimal.
 */
export function ThemeRenderer({ themeName, ...props }: { themeName: string } & ThemeRenderProps) {
  const Bespoke = BESPOKE[themeName];
  if (Bespoke) {
    return <Bespoke {...props} />;
  }

  const tokens = THEME_BY_NAME.get(themeName);
  if (tokens) {
    return <TokenTheme tokens={tokens} {...props} />;
  }

  return <MinimalTheme {...props} />;
}
