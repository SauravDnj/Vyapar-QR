import { DEFAULT_THEME_NAME } from '@vyaparqr/types';

import { NoorTheme } from './noor';

import type { ThemeRenderProps } from '@vyaparqr/types';

const THEMES: Record<string, (props: ThemeRenderProps) => React.JSX.Element> = {
  Noor: NoorTheme,
};

/**
 * Renders the theme a client has selected, by its `name` as stored in the
 * database.
 *
 * A name that isn't in the catalog — a theme from the retired catalog that a
 * page still points at, including every page still on "Zevar" until
 * `db:sync-themes` moves it — falls back to the default rather than breaking a
 * live business's page.
 */
export function ThemeRenderer({ themeName, ...props }: { themeName: string } & ThemeRenderProps) {
  const Theme = THEMES[themeName] ?? THEMES[DEFAULT_THEME_NAME] ?? NoorTheme;
  return <Theme {...props} />;
}
