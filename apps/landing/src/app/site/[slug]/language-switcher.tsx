'use client';

import { usePathname, useSearchParams } from 'next/navigation';

/** Only renders once a client has actually added a translation (P3-04) —
 * most pages stay single-language and show nothing here. */
export function LanguageSwitcher({ locales }: { locales: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get('lang');

  if (locales.length === 0) {
    return null;
  }

  function hrefFor(locale: string | null): string {
    const params = new URLSearchParams(searchParams.toString());
    if (locale) params.set('lang', locale);
    else params.delete('lang');
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="flex justify-center gap-2 py-3">
      <a href={hrefFor(null)} className={`text-xs ${!active ? 'font-semibold underline' : 'text-gray-400'}`}>
        Default
      </a>
      {locales.map((locale) => (
        <a
          key={locale}
          href={hrefFor(locale)}
          className={`text-xs ${active === locale ? 'font-semibold underline' : 'text-gray-400'}`}
        >
          {locale}
        </a>
      ))}
    </div>
  );
}
