import { buildGoogleReviewUrl, isGoogleLink, parseGoogleLink } from './google-review-link';
import { buildReviewMessages, cleanGeneratedReview, composeReviewWithoutAi } from './review-writer';

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
