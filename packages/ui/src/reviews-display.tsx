import type { PublicReviewItem } from '@qrhub/types';

function stars(rating: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, Math.round(rating)))).padEnd(5, '☆');
}

export function ReviewsDisplay({ reviews }: { reviews: PublicReviewItem[] }) {
  if (reviews.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((review) => (
        <div key={review.id} className="rounded border p-3 text-left text-sm">
          <p className="text-amber-500">{stars(review.rating)}</p>
          <p className="font-medium">{review.reviewerName}</p>
          {review.comment ? <p className="text-gray-600">{review.comment}</p> : null}
        </div>
      ))}
    </div>
  );
}
