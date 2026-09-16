import { blankToNull } from './google-review-link';

import type { GroqChatMessage } from '../ai/groq.service';

/**
 * Turns a happy customer's rough words ("cafe food is best") into a Google
 * review they can post themselves.
 *
 * The one hard rule on both paths: only what the customer said. Google's
 * review policy wants reviews to reflect a real experience, and a review
 * that invents a dish, a staff name or a price is exactly the fake-looking
 * content that gets filtered — so the AI polishes and expands the
 * customer's own words, it never adds facts to them.
 */
export interface ReviewWriterInput {
  businessName: string;
  rating: number;
  notes?: string;
  highlights?: string[];
  /** 0 for the first draft; each "Try another" bumps it for variety. */
  variant?: number;
}

export function buildReviewMessages(input: ReviewWriterInput): GroqChatMessage[] {
  const highlights = cleanHighlights(input.highlights);
  return [
    {
      role: 'system',
      content: [
        'You help a real customer turn their own rough notes into a clear, natural Google review that they will post themselves.',
        'Rules:',
        '- Write in first person, as that customer.',
        '- Use ONLY what is in their notes and the highlights they picked. Never invent dishes, products, staff names, prices, dates or events.',
        '- If the notes are in Hindi, Hinglish or any other language, write the review in that same language and script.',
        '- 2 to 4 sentences, roughly 25 to 70 words. Specific and genuine, not salesy.',
        '- Match the rating: 5 stars is very positive, 4 stars is positive.',
        '- No emojis, hashtags, markdown, or surrounding quotation marks. Output only the review text.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Business: ${input.businessName}`,
        `My rating: ${String(input.rating)}/5`,
        `What stood out: ${highlights.length > 0 ? highlights.join(', ') : '(none picked)'}`,
        `My own words: ${blankToNull(input.notes) ?? '(nothing written)'}`,
        input.variant
          ? `Write a fresh version, worded differently from before (version ${String(input.variant + 1)}).`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

/** Strips what models add despite being told not to: wrapping quotes and a
 * leading "Here's your review:" line. */
export function cleanGeneratedReview(text: string): string {
  return text
    .replace(/^\s*(here(?:'s| is)[^\n:]*:)\s*/i, '')
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();
}

/**
 * The no-AI path, used when no Groq key is configured or the call fails, so
 * the customer still gets a usable review instead of an error. Rotates
 * phrasing by `variant` so "Try another" still does something.
 */
export function composeReviewWithoutAi(input: ReviewWriterInput): string {
  const variant = Math.abs(input.variant ?? 0);
  const name = input.businessName.trim();
  const notes = sentence(input.notes ?? '');
  const highlights = cleanHighlights(input.highlights).map((item) => item.toLowerCase());

  // Notes written in another script read wrongly wrapped in English filler —
  // keep the customer's own sentence as the review.
  if (notes && /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(notes)) {
    return notes;
  }

  const openers =
    input.rating >= 5
      ? [
          `Had a wonderful experience at ${name}.`,
          `Really enjoyed my visit to ${name}.`,
          `${name} is a place I'd happily recommend.`,
        ]
      : [
          `Had a good experience at ${name}.`,
          `Nice experience at ${name}.`,
          `Enjoyed my visit to ${name}.`,
        ];
  const closers =
    input.rating >= 5
      ? ['Highly recommended!', 'Will definitely be coming back.', 'Would recommend it to anyone.']
      : ['Would recommend.', 'Worth a visit.', 'Would visit again.'];

  const parts = [pick(openers, variant)];
  if (notes) {
    parts.push(notes);
  }
  if (highlights.length > 0) {
    parts.push(
      `${pick(['Loved the', 'Really liked the', 'Special mention for the'], variant)} ${joinList(highlights)}.`,
    );
  }
  if (!notes && highlights.length === 0) {
    parts.push(
      pick(
        [
          'Everything was handled well.',
          'Good service from start to finish.',
          'A pleasant visit overall.',
        ],
        variant,
      ),
    );
  }
  parts.push(pick(closers, variant));
  return parts.join(' ');
}

function cleanHighlights(highlights: string[] | undefined): string[] {
  return (highlights ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

/** Capitalises and punctuates a customer's rough note as one sentence. */
function sentence(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (/[.!?।]$/.test(capitalised)) return capitalised;
  return /\p{Script=Devanagari}/u.test(capitalised) ? `${capitalised}।` : `${capitalised}.`;
}

function pick<T>(options: readonly T[], variant: number): T {
  return options[variant % options.length];
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}
