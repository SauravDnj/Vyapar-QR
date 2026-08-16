/** Links to the client's phone-lookup loyalty page — only rendered when
 * the client has an active loyalty program (see `ThemeRenderProps.loyaltyActive`). */
export function LoyaltyCardLink({ slug, active }: { slug?: string; active?: boolean }) {
  if (!active || !slug) {
    return null;
  }

  return (
    <a href={`/site/${slug}/loyalty`} className="text-sm font-medium underline">
      View my loyalty card
    </a>
  );
}
