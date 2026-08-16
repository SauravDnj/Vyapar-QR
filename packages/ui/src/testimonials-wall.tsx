import type { PublicTestimonial } from '@qrhub/types';

function stars(rating: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, Math.round(rating)))).padEnd(5, '☆');
}

/** Client-curated quotes — distinct from `ReviewsDisplay`, which shows
 * cached Google Reviews. Only approved testimonials ever reach this prop. */
export function TestimonialsWall({ testimonials }: { testimonials: PublicTestimonial[] }) {
  if (testimonials.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {testimonials.map((testimonial) => (
        <div key={testimonial.id} className="rounded border p-3 text-left text-sm">
          {testimonial.rating ? <p className="text-amber-500">{stars(testimonial.rating)}</p> : null}
          <p className="italic text-gray-700">&ldquo;{testimonial.quote}&rdquo;</p>
          <p className="mt-1 font-medium">— {testimonial.authorName}</p>
        </div>
      ))}
    </div>
  );
}
