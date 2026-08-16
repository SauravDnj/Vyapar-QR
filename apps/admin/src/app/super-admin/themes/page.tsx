'use client';

import { ThemeRenderer } from '@qrhub/ui';
import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { Drawer } from '../../../components/ui/drawer';
import { PhoneFrame } from '../../../components/ui/phone-frame';
import { useAuth } from '../../../context/auth-context';
import { createTheme, listAdminThemes, updateTheme, type CatalogTheme } from '../../../lib/admin-api';

import type { PublicPaymentMethod, PublicReviewItem, PublicSocialLink, ThemeContent } from '@qrhub/types';

/** Realistic sample content so a preview shows a fully "filled in" page
 * instead of empty placeholder text — every section renders. */
const SAMPLE_CONTENT: ThemeContent = {
  hero: { logoUrl: '', headline: 'Sunrise Cafe', tagline: 'Coffee, breakfast & good mornings' },
  about: {
    description: 'A neighbourhood cafe serving fresh coffee, breakfast, and light bites since 2019.',
    address: '12 MG Road, Bengaluru',
    hours: 'Mon–Sun, 7am–9pm',
    phone: '+91 98765 43210',
  },
  menu: { heading: 'Menu', fileUrl: '' },
  payment: { heading: 'Pay us' },
  reviews: { heading: 'Rate us' },
  social: { heading: 'Follow us' },
  contact: { heading: 'Get in touch' },
  footer: { text: '© Sunrise Cafe' },
};

const SAMPLE_PAYMENT_METHODS: PublicPaymentMethod[] = [
  { id: 'sample-1', type: 'gpay', qrImageUrl: null, upiId: 'sunrisecafe@okhdfcbank', displayOrder: 0 },
];

const SAMPLE_SOCIAL_LINKS: PublicSocialLink[] = [
  { id: 'sample-1', platform: 'whatsapp', value: '919876543210', displayOrder: 0 },
  { id: 'sample-2', platform: 'instagram', value: 'sunrisecafe', displayOrder: 1 },
];

const SAMPLE_REVIEWS: PublicReviewItem[] = [
  { id: 'sample-1', reviewerName: 'Asha K.', rating: 5, comment: 'Best filter coffee in the area!', reviewDate: new Date().toISOString() },
  { id: 'sample-2', reviewerName: 'Rahul M.', rating: 4, comment: 'Great breakfast, cozy spot.', reviewDate: new Date().toISOString() },
];

const PREVIEW_COLORS = ['', '#0e7c66', '#0866ff', '#c0442f', '#6366f1', '#111111'];

function ThemePreviewDrawer({
  theme,
  accessToken,
  onClose,
  onSaved,
}: {
  theme: CatalogTheme | null;
  accessToken: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayTheme, setDisplayTheme] = useState(theme);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', category: '', isPremium: false });
  const [isSaving, setIsSaving] = useState(false);

  if (theme && theme !== displayTheme) {
    setDisplayTheme(theme);
    setAccentColor(null);
    setIsEditing(false);
    setEditForm({ name: theme.name, category: theme.category, isPremium: theme.isPremium });
  }

  if (!displayTheme) {
    return <Drawer isOpen={theme !== null} onClose={onClose}>{null}</Drawer>;
  }

  async function handleSave() {
    if (!accessToken || !displayTheme) return;
    setIsSaving(true);
    try {
      await updateTheme(accessToken, displayTheme.id, editForm);
      setIsEditing(false);
      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleArchive() {
    if (!accessToken || !displayTheme) return;
    setIsSaving(true);
    try {
      await updateTheme(accessToken, displayTheme.id, { isArchived: !displayTheme.isArchived });
      onSaved();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Drawer isOpen={theme !== null} onClose={onClose}>
      <div className="flex items-start justify-between">
        {isEditing ? (
          <div className="flex flex-1 flex-col gap-2">
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="rounded border border-border-color px-2 py-1 text-sm"
              placeholder="Name"
            />
            <input
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              className="rounded border border-border-color px-2 py-1 text-sm"
              placeholder="Category"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editForm.isPremium}
                onChange={(e) => setEditForm({ ...editForm, isPremium: e.target.checked })}
              />
              Premium
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="rounded bg-accent px-3 py-1 text-xs text-accent-foreground disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setIsEditing(false)} className="rounded border border-border-color px-3 py-1 text-xs">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-lg font-semibold">{displayTheme.name}</p>
            <p className="text-sm text-muted">{displayTheme.category}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setIsEditing(true)} className="text-xs text-accent underline">
                Edit
              </button>
              <button onClick={() => void handleToggleArchive()} disabled={isSaving} className="text-xs text-danger underline">
                {displayTheme.isArchived ? 'Unarchive' : 'Archive'}
              </button>
            </div>
          </div>
        )}
        <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close drawer">
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Preview accent:</span>
        {PREVIEW_COLORS.map((color) => (
          <button
            key={color || 'default'}
            onClick={() => setAccentColor(color || null)}
            aria-label={color || 'Theme default'}
            className={`h-6 w-6 rounded-full border-2 ${accentColor === color || (!accentColor && !color) ? 'border-accent' : 'border-transparent'}`}
            style={{ backgroundColor: color || 'var(--border-color)' }}
          />
        ))}
      </div>

      <PhoneFrame>
        <ThemeRenderer
          themeName={displayTheme.name}
          businessName="Sunrise Cafe"
          content={SAMPLE_CONTENT}
          paymentMethods={SAMPLE_PAYMENT_METHODS}
          socialLinks={SAMPLE_SOCIAL_LINKS}
          reviewConfig={{ reviewLink: 'https://example.com', avgRatingCached: '4.8' }}
          reviews={SAMPLE_REVIEWS}
          accentColor={accentColor}
        />
      </PhoneFrame>
    </Drawer>
  );
}

const EMPTY_NEW_THEME = { name: '', category: '', isPremium: false };

function ThemesContent() {
  const { accessToken } = useAuth();
  const [themes, setThemes] = useState<CatalogTheme[]>([]);
  const [category, setCategory] = useState('');
  const [previewTheme, setPreviewTheme] = useState<CatalogTheme | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTheme, setNewTheme] = useState(EMPTY_NEW_THEME);
  const [isCreating, setIsCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      setThemes(await listAdminThemes(accessToken));
    } catch {
      setError('Failed to load themes.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setIsCreating(true);
    setError(null);
    try {
      await createTheme(accessToken, newTheme);
      setNewTheme(EMPTY_NEW_THEME);
      await refresh();
    } catch {
      setError('Failed to create theme.');
    } finally {
      setIsCreating(false);
    }
  }

  const categories = ['', ...Array.from(new Set(themes.map((theme) => theme.category))).sort()];
  const visible = category ? themes.filter((theme) => theme.category === category) : themes;

  return (
    <>
      <h1 className="text-2xl font-semibold">Theme catalog</h1>
      <p className="text-sm text-muted">Every landing-page theme available to clients, by category. Click a theme for a live preview, or manage its listing.</p>
      {error && <p className="text-sm text-danger">{error}</p>}

      {!isLoading && themes.length > 0 && (
        <div className="flex flex-wrap overflow-hidden rounded-md border border-border-color font-mono text-sm w-fit">
          {categories.map((cat) => (
            <button
              key={cat || 'all'}
              onClick={() => setCategory(cat)}
              className={`border-l border-border-color px-3 py-1.5 first:border-l-0 ${category === cat ? 'bg-accent text-accent-foreground' : ''}`}
            >
              {cat || 'All'}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p>Loading…</p>
      ) : themes.length === 0 ? (
        <p className="text-muted">No themes found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setPreviewTheme(theme)}
              className={`flex flex-col gap-3 overflow-hidden rounded-lg border border-border-color bg-surface text-left transition-transform hover:-translate-y-0.5 ${theme.isArchived ? 'opacity-50' : ''}`}
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex h-36 items-center justify-center bg-border-color/20">
                {theme.previewImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={theme.previewImageUrl} alt={theme.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-mono text-xs text-muted">Click to preview</span>
                )}
              </div>
              <div className="flex items-center justify-between px-4 pb-4">
                <div>
                  <p className="font-medium">{theme.name}</p>
                  <p className="text-xs text-muted">{theme.category}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={theme.isPremium ? 'info' : 'success'}>{theme.isPremium ? 'Premium' : 'Free'}</Badge>
                  {theme.isArchived && <Badge tone="neutral">Archived</Badge>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <ThemePreviewDrawer
        theme={previewTheme}
        accessToken={accessToken}
        onClose={() => setPreviewTheme(null)}
        onSaved={() => void refresh()}
      />

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="flex max-w-md flex-col gap-3 border-t border-border-color pt-6"
      >
        <h2 className="text-lg font-semibold">New theme</h2>
        <p className="text-xs text-muted">
          Registers a catalog entry clients can select. It renders with the Minimal layout until a matching design
          is added to the theme registry in code.
        </p>
        <input
          required
          placeholder="Name"
          value={newTheme.name}
          onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
          className="rounded border border-border-color px-3 py-2"
        />
        <input
          required
          placeholder="Category"
          value={newTheme.category}
          onChange={(e) => setNewTheme({ ...newTheme, category: e.target.value })}
          className="rounded border border-border-color px-3 py-2"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={newTheme.isPremium}
            onChange={(e) => setNewTheme({ ...newTheme, isPremium: e.target.checked })}
          />
          Premium
        </label>
        <button
          type="submit"
          disabled={isCreating}
          className="w-fit rounded-md bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50"
        >
          {isCreating ? 'Creating…' : 'Create theme'}
        </button>
      </form>
    </>
  );
}

export default function ThemesPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <ThemesContent />
    </ProtectedRoute>
  );
}
