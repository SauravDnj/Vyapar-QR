'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import {
  addLoyaltyStamp,
  getLoyaltyProgram,
  listLoyaltyCards,
  redeemLoyaltyCard,
  saveLoyaltyProgram,
  type LoyaltyCard,
  type LoyaltyProgram,
} from '../../../lib/loyalty-api';

function LoyaltyContent() {
  const { accessToken } = useAuth();
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stampsRequired, setStampsRequired] = useState(9);
  const [rewardText, setRewardText] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isSavingProgram, setIsSavingProgram] = useState(false);
  const [stampPhone, setStampPhone] = useState('');
  const [isStamping, setIsStamping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [programResult, cardsResult] = await Promise.all([getLoyaltyProgram(accessToken), listLoyaltyCards(accessToken)]);
      setProgram(programResult);
      setCards(cardsResult);
      if (programResult) {
        setStampsRequired(programResult.stampsRequired);
        setRewardText(programResult.rewardText);
        setIsActive(programResult.isActive);
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleSaveProgram() {
    if (!accessToken || !rewardText.trim()) return;
    setIsSavingProgram(true);
    setMessage(null);
    try {
      setProgram(await saveLoyaltyProgram(accessToken, { stampsRequired, rewardText: rewardText.trim(), isActive }));
      setMessage('Saved.');
    } catch {
      setMessage('Failed to save.');
    } finally {
      setIsSavingProgram(false);
    }
  }

  async function handleAddStamp() {
    if (!accessToken || !stampPhone.trim()) return;
    setIsStamping(true);
    setMessage(null);
    try {
      await addLoyaltyStamp(accessToken, stampPhone.trim());
      setStampPhone('');
      await refresh();
    } catch {
      setMessage('Failed to add stamp — make sure your program is active.');
    } finally {
      setIsStamping(false);
    }
  }

  async function handleRedeem(id: string) {
    if (!accessToken) return;
    setMessage(null);
    try {
      await redeemLoyaltyCard(accessToken, id);
      await refresh();
    } catch {
      setMessage('This card is not eligible for redemption yet.');
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Loyalty program</h1>
      <p className="text-sm text-muted">A digital stamp card for repeat customers — no app download needed.</p>
      {message && <p className="text-sm">{message}</p>}

      <div className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4">
        <p className="font-medium">Program settings</p>
        <label className="flex flex-col gap-1 text-sm">
          Stamps required for a reward
          <input
            type="number"
            min={2}
            max={50}
            value={stampsRequired}
            onChange={(e) => setStampsRequired(Number(e.target.value))}
            className="w-32 rounded-md border border-border-color px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Reward
          <input
            value={rewardText}
            onChange={(e) => setRewardText(e.target.value)}
            placeholder="e.g. Free coffee"
            className="rounded-md border border-border-color px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Program active
        </label>
        <button
          disabled={isSavingProgram || !rewardText.trim()}
          onClick={() => void handleSaveProgram()}
          className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {isSavingProgram ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border-color p-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Add a stamp — customer phone
          <input
            value={stampPhone}
            onChange={(e) => setStampPhone(e.target.value)}
            placeholder="Phone number"
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <button
          disabled={isStamping || !stampPhone.trim() || !program?.isActive}
          onClick={() => void handleAddStamp()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {isStamping ? 'Adding…' : 'Add stamp'}
        </button>
      </div>

      <h2 className="text-lg font-medium">Customer cards ({cards.length})</h2>
      {cards.length === 0 ? (
        <p className="text-sm text-muted">No cards yet — add a stamp to create one.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map((card) => {
            const eligible = program ? card.stampCount >= program.stampsRequired : false;
            return (
              <div
                key={card.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border-color bg-surface p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{card.customerPhone}</p>
                  <p className="text-muted">
                    {card.stampCount} / {program?.stampsRequired ?? '—'} stamps
                    {card.redemptionCount ? ` · redeemed ${card.redemptionCount}x` : ''}
                  </p>
                </div>
                <button
                  disabled={!eligible}
                  onClick={() => void handleRedeem(card.id)}
                  className="rounded-md border border-border-color px-3 py-1 text-xs disabled:opacity-40"
                >
                  Redeem
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function LoyaltyPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <LoyaltyContent />
    </ProtectedRoute>
  );
}
