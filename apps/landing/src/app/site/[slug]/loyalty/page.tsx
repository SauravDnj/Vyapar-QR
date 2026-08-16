'use client';

import { use, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

interface LoyaltyLookupResult {
  active: boolean;
  cardId?: string | null;
  stampsRequired?: number;
  rewardText?: string;
  stampCount?: number;
  redemptionCount?: number;
}

function WalletButtons({ slug, cardId }: { slug: string; cardId: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleAppleWallet() {
    setMessage(null);
    const response = await fetch(`${API_URL}/public/landing/${slug}/loyalty/${cardId}/apple-pass`);
    if (!response.ok) {
      setMessage('Add to Apple Wallet isn’t available yet.');
      return;
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'loyalty-card.pkpass';
    link.click();
    URL.revokeObjectURL(blobUrl);
  }

  async function handleGoogleWallet() {
    setMessage(null);
    const response = await fetch(`${API_URL}/public/landing/${slug}/loyalty/${cardId}/google-wallet-link`);
    if (!response.ok) {
      setMessage('Add to Google Wallet isn’t available yet.');
      return;
    }
    const { link } = (await response.json()) as { link: string };
    window.location.href = link;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        <button onClick={() => void handleAppleWallet()} className="rounded border px-3 py-1.5 text-xs font-medium">
          Add to Apple Wallet
        </button>
        <button onClick={() => void handleGoogleWallet()} className="rounded border px-3 py-1.5 text-xs font-medium">
          Add to Google Wallet
        </button>
      </div>
      {message ? <p className="text-xs text-gray-500">{message}</p> : null}
    </div>
  );
}

export default function LoyaltyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<LoyaltyLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    if (!phone.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/public/landing/${slug}/loyalty?phone=${encodeURIComponent(phone.trim())}`);
      if (!response.ok) {
        throw new Error('Request failed');
      }
      setResult((await response.json()) as LoyaltyLookupResult);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col items-center gap-6 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Your loyalty card</h1>
      <p className="text-sm text-gray-500">Enter your phone number to check your stamps.</p>

      <div className="flex w-full gap-2">
        <input
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
          }}
          placeholder="Phone number"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button
          onClick={() => void handleLookup()}
          disabled={isLoading || !phone.trim()}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isLoading ? '…' : 'Check'}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {result && !result.active ? <p className="text-sm text-gray-500">This business doesn&apos;t have an active loyalty program.</p> : null}

      {result?.active ? (
        <div className="flex w-full flex-col items-center gap-3 rounded-lg border p-5">
          <p className="text-sm text-gray-500">Reward: {result.rewardText}</p>
          <div className="flex flex-wrap justify-center gap-1">
            {Array.from({ length: result.stampsRequired ?? 0 }, (_, index) => (
              <span key={index} className="text-2xl leading-none">
                {index < (result.stampCount ?? 0) ? '⭐' : '☆'}
              </span>
            ))}
          </div>
          <p className="text-sm font-medium">
            {result.stampCount ?? 0} / {result.stampsRequired} stamps
          </p>
          {(result.stampCount ?? 0) >= (result.stampsRequired ?? Infinity) ? (
            <p className="text-sm text-emerald-700">You&apos;ve earned your reward — show this screen next visit!</p>
          ) : null}
          {result.redemptionCount ? <p className="text-xs text-gray-400">Rewards redeemed so far: {result.redemptionCount}</p> : null}
          {result.cardId ? <WalletButtons slug={slug} cardId={result.cardId} /> : null}
        </div>
      ) : null}
    </main>
  );
}
