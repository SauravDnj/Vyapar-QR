import { DEFAULT_THEME_NAME } from '@vyaparqr/types';

import { AuroraTheme } from './aurora';
import { IvoryTheme } from './ivory';
import { NoirTheme } from './noir';

import type { ThemeRenderProps } from '@vyaparqr/types';

const THEMES: Record<string, (props: ThemeRenderProps) => React.JSX.Element> = {
  Ivory: IvoryTheme,
  Noir: NoirTheme,
  Aurora: AuroraTheme,
};

/**
 * Renders the theme a client has selected, by its `name` as stored in the
 * database.
 *
 * A name that isn't in the catalog — a theme from the retired catalog that a
 * page still points at, or one a Super Admin created without a renderer —
 * falls back to the default rather than breaking a live business's page.
 */
export function ThemeRenderer({ themeName, ...props }: { themeName: string } & ThemeRenderProps) {
  const Theme = THEMES[themeName] ?? THEMES[DEFAULT_THEME_NAME] ?? IvoryTheme;
  return <Theme {...props} />;
}
