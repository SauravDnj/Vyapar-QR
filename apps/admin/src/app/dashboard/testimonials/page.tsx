'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { deleteTestimonial, listTestimonials, updateTestimonial, type Testimonial } from '../../../lib/testimonials-api';

function stars(rating: number | null): string {
  if (!rating) return '';
  return '★'.repeat(rating).padEnd(5, '☆');
}

function TestimonialsContent() {
  const { accessToken } = useAuth();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      setTestimonials(await listTestimonials(accessToken));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleToggleApproval(id: string, isApproved: boolean) {
    if (!accessToken) return;
    setTestimonials((prev) => prev.map((t) => (t.id === id ? { ...t, isApproved } : t)));
    try {
      await updateTestimonial(accessToken, id, { isApproved });
    } catch {
      setMessage('Failed to update.');
      await refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return;
    setTestimonials((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTestimonial(accessToken, id);
    } catch {
      setMessage('Failed to delete.');
      await refresh();
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  const approved = testimonials.filter((t) => t.isApproved);
  const pending = testimonials.filter((t) => !t.isApproved);

  return (
    <>
      <h1 className="text-2xl font-semibold">Testimonials</h1>
      <p className="text-sm text-muted">
        Approve which visitor-submitted quotes show publicly on your page. This is separate from your Google Reviews sync.
      </p>
      {message && <p className="text-sm text-danger">{message}</p>}

      <h2 className="text-lg font-medium">Pending ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-muted">Nothing waiting for review.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border-color bg-surface p-4">
              <div className="flex flex-col gap-1">
                {t.rating ? <p className="text-sm text-amber-500">{stars(t.rating)}</p> : null}
                <p className="text-sm italic">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-sm font-medium">— {t.authorName}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => void handleToggleApproval(t.id, true)}
                  className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                >
                  Approve
                </button>
                <button onClick={() => void handleDelete(t.id)} className="rounded-md border border-border-color px-3 py-1 text-xs">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-medium">Showing on your page ({approved.length})</h2>
      {approved.length === 0 ? (
        <p className="text-sm text-muted">Nothing approved yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {approved.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border-color bg-surface p-4">
              <div className="flex flex-col gap-1">
                {t.rating ? <p className="text-sm text-amber-500">{stars(t.rating)}</p> : null}
                <p className="text-sm italic">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-sm font-medium">— {t.authorName}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => void handleToggleApproval(t.id, false)}
                  className="rounded-md border border-border-color px-3 py-1 text-xs"
                >
                  Unpublish
                </button>
                <button onClick={() => void handleDelete(t.id)} className="rounded-md border border-border-color px-3 py-1 text-xs">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function TestimonialsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <TestimonialsContent />
    </ProtectedRoute>
  );
}
