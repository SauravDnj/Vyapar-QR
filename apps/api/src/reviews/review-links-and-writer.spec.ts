import { buildGoogleReviewUrl, isGoogleLink, parseGoogleLink } from './google-review-link';
import { buildReviewMessages, cleanGeneratedReview, composeReviewWithoutAi, matchedKeywords } from './review-writer';

describe('Google review links', () => {
  it.each([
    'https://share.google/ddjkwGZClHojmQ1Io',
    'https://maps.app.goo.gl/abc123',
    'https://g.page/r/CabcDEF/review',
    'https://www.google.com/maps/place/Blue+Bean',
    'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
    'https://www.google.co.in/search?q=cafe',
  ])('accepts %s', (url) => {
    expect(isGoogleLink(url)).toBe(true);
  });

  it.each(['https://evil.com/share.google', 'https://share.google.evil.com/x', 'javascript:alert(1)', 'not a url', 'https://notgoogle.com'])(
    'rejects %s',
    (url) => {
      expect(isGoogleLink(url)).toBe(false);
    },
  );

  it('reads the business name from a resolved share link', () => {
    const parsed = parseGoogleLink('https://www.google.com/search?kgmid=/g/11bbrfs6tb&q=Navin+Tailor+%26+Textorium');
    expect(parsed).toEqual({ placeId: null, businessName: 'Navin Tailor & Textorium' });
  });

  it('prefers a Place ID so the review box opens directly', () => {
    expect(buildGoogleReviewUrl({ reviewLink: 'https://share.google/x', googlePlaceId: 'ChIJabcdefghij' })).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJabcdefghij',
    );
  });

  it('falls back to the pasted share link', () => {
    expect(buildGoogleReviewUrl({ reviewLink: 'https://share.google/x' })).toBe('https://share.google/x');
    expect(buildGoogleReviewUrl({ reviewLink: 'Blue Bean Cafe' })).toBeNull();
  });
});

describe('review writer', () => {
  const base = { businessName: 'Blue Bean Cafe', rating: 5 };

  it('builds a review from the customer’s own words without inventing', () => {
    const text = composeReviewWithoutAi({ ...base, notes: 'cafe food is best', highlights: ['Food', 'Service'] });
    expect(text).toContain('Cafe food is best.');
    expect(text).toContain('food and service');
    expect(text).toContain('Blue Bean Cafe');
  });

  it('keeps notes in another script as the customer wrote them', () => {
    expect(composeReviewWithoutAi({ ...base, notes: 'खाना बहुत अच्छा था' })).toBe('खाना बहुत अच्छा था।');
  });

  it('words "Try another" differently', () => {
    expect(composeReviewWithoutAi({ ...base, variant: 0 })).not.toBe(composeReviewWithoutAi({ ...base, variant: 1 }));
  });

  it('tells the model to use only the customer’s facts and language', () => {
    const [system, user] = buildReviewMessages({ ...base, notes: 'cafe food is best' });
    expect(system.content).toMatch(/ONLY what is in their notes/);
    expect(system.content).toMatch(/same language/);
    expect(user.content).toContain('cafe food is best');
  });

  it('strips wrapping quotes and preambles from model output', () => {
    expect(cleanGeneratedReview('Here is your review:\n"Great coffee and friendly staff."')).toBe('Great coffee and friendly staff.');
  });
});

describe('review writer — service words and area (SEO)', () => {
  const base = { businessName: 'Shree Gold Jewellers', rating: 5 as const, locality: 'Jayanagar, Bengaluru' };
  const keywords = ['bridal gold sets', 'temple jewellery', 'hallmarked chains'];

  it('offers a service word only when the customer already said it', () => {
    expect(matchedKeywords({ ...base, keywords, notes: 'bought a bridal set for my sister' })).toEqual([
      'bridal gold sets',
    ]);
  });

  it('offers nothing when the customer never mentioned any of them', () => {
    expect(matchedKeywords({ ...base, keywords, notes: 'staff was very polite' })).toEqual([]);
  });

  it('offers nothing when the customer wrote nothing at all', () => {
    expect(matchedKeywords({ ...base, keywords })).toEqual([]);
  });

  it('never offers more than two, so a review cannot become a keyword list', () => {
    const matched = matchedKeywords({
      ...base,
      keywords,
      notes: 'bridal and temple pieces, all hallmarked chains too',
    });
    expect(matched).toHaveLength(2);
  });

  it('names the area once in the template review', () => {
    const review = composeReviewWithoutAi({ ...base, notes: 'lovely bangles' });
    expect(review).toContain('Jayanagar, Bengaluru');
    expect(review.match(/Jayanagar/g)).toHaveLength(1);
  });

  it('puts the area and the allowed service words in the AI prompt', () => {
    const messages = buildReviewMessages({ ...base, keywords, notes: 'bought a bridal set' });
    const user = messages[1]?.content ?? '';
    expect(user).toContain('Area: Jayanagar, Bengaluru');
    expect(user).toContain('bridal gold sets');
    expect(messages[0]?.content).toMatch(/Never stuff keywords/);
  });

  it('leaves a review with no area exactly as it was', () => {
    const review = composeReviewWithoutAi({ businessName: 'Blue Bean Cafe', rating: 5, notes: 'great filter coffee' });
    expect(review).toContain('Blue Bean Cafe');
    expect(review).not.toContain('undefined');
  });
});

describe('review writer — no stuffing', () => {
  const base = {
    businessName: 'Shree Gold Jewellers',
    rating: 5 as const,
    locality: 'Jayanagar',
    keywords: ['bridal gold sets', 'temple jewellery'],
  };

  it('does not repeat a service the customer already named', () => {
    const review = composeReviewWithoutAi({ ...base, notes: 'bought a lovely bridal set here' });
    expect(review.toLowerCase().match(/bridal/g)).toHaveLength(1);
  });

  it('still adds one when only a chip pointed at it', () => {
    const review = composeReviewWithoutAi({ ...base, highlights: ['Bridal gold'], notes: 'staff were patient' });
    expect(review.toLowerCase()).toContain('bridal gold sets');
  });
});
