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
import { TrustlineTheme } from './trustline';
import { VitalityTheme } from './vitality';

import type { ThemeRenderProps } from '@qrhub/types';

/** Renders the right starter theme for a given Theme `name` (as seeded in the
 * database). A switch — rather than a name -> component lookup handed to
 * JSX — keeps every rendered tag a statically-known component reference. */
export function ThemeRenderer({ themeName, ...props }: { themeName: string } & ThemeRenderProps) {
  switch (themeName) {
    case 'Academy':
      return <AcademyTheme {...props} />;
    case 'Aperture':
      return <ApertureTheme {...props} />;
    case 'Bold':
      return <BoldTheme {...props} />;
    case 'Elegant':
      return <ElegantTheme {...props} />;
    case 'Spice':
      return <SpiceTheme {...props} />;
    case 'Serene':
      return <SereneTheme {...props} />;
    case 'Storefront':
      return <StorefrontTheme {...props} />;
    case 'Trustline':
      return <TrustlineTheme {...props} />;
    case 'Executive':
      return <ExecutiveTheme {...props} />;
    case 'Ironclad':
      return <IroncladTheme {...props} />;
    case 'Vitality':
      return <VitalityTheme {...props} />;
    case 'Nest':
      return <NestTheme {...props} />;
    default:
      return <MinimalTheme {...props} />;
  }
}
