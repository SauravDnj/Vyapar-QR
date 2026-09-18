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
  /** Area or city to name once, e.g. "Jayanagar, Bengaluru". */
  locality?: string;
  /** What the business sells, from its own settings. Only ever used to pick
   * wording for something the customer already said. */
  keywords?: string[];
}

/**
 * Which of the business's own service words the customer's message supports.
 *
 * This is the whole SEO idea, and its limit. A review that names the service
 * and the place — "the bridal set we picked up in Jayanagar" — is what makes
 * a business findable for that search. But only the customer can say it
 * happened, so a keyword is offered to the writer only when their own notes
 * or picked highlights already point at it. The rest are dropped.
 */
export function matchedKeywords(input: ReviewWriterInput): string[] {
  const keywords = (input.keywords ?? []).map((item) => item.trim()).filter(Boolean);
  if (keywords.length === 0) {
    return [];
  }

  const said = [input.notes ?? '', ...(input.highlights ?? [])].join(' ').toLowerCase();
  if (!said.trim()) {
    return [];
  }

  return keywords
    .filter((keyword) => {
      const words = keyword
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 3);
      return words.some((word) => said.includes(word));
    })
    .slice(0, 2);
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
        '- Name the business once, naturally, the way a person would.',
        '- If an area is given, work it in once and only once ("...in Jayanagar").',
        '- Service words are suggested wording for what the customer already said. If their notes do not support one, leave it out.',
        '- Never stuff keywords. It has to read like one person describing one visit.',
        '- No emojis, hashtags, markdown, or surrounding quotation marks. Output only the review text.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Business: ${input.businessName}`,
        blankToNull(input.locality) ? `Area: ${input.locality ?? ''}` : '',
        matchedKeywords(input).length > 0
          ? `Service words I may use where they fit what I said: ${matchedKeywords(input).join(', ')}`
          : '',
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

  // The area, named once, is what makes the review searchable for "<service>
  // near me" — and it is a fact about the business, not a claim about the
  // customer's visit, so the template may add it where the AI may not.
  const place = blankToNull(input.locality) ? `${name} in ${(input.locality ?? '').trim()}` : name;

  const openers =
    input.rating >= 5
      ? [
          `Had a wonderful experience at ${place}.`,
          `Really enjoyed my visit to ${place}.`,
          `${place} is a place I'd happily recommend.`,
        ]
      : [
          `Had a good experience at ${place}.`,
          `Nice experience at ${place}.`,
          `Enjoyed my visit to ${place}.`,
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
  // Only ever a service the customer's own words already pointed at — and
  // only when those words aren't already in the review, or the template would
  // say "filter coffee" twice in three sentences, which is the keyword
  // stuffing this is supposed to avoid.
  const said = notes.toLowerCase();
  const keywords = matchedKeywords(input)
    .map((item) => item.toLowerCase())
    .filter((keyword) => !keyword.split(/\s+/).some((word) => word.length > 3 && said.includes(word)));
  if (keywords.length > 0) {
    parts.push(
      `${pick(['Happy with the', 'Really pleased with the', 'No complaints about the'], variant)} ${joinList(keywords)}.`,
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
