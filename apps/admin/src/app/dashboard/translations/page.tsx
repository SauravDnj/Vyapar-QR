'use client';

import { DEFAULT_THEME_SCHEMA } from '@qrhub/types';
import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { deleteTranslation, listTranslations, saveTranslation, type Translation } from '../../../lib/translations-api';

function TranslationsContent() {
  const { accessToken } = useAuth();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [activeLocale, setActiveLocale] = useState<string | null>(null);
  const [newLocale, setNewLocale] = useState('');
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await listTranslations(accessToken);
      setTranslations(result);
    } catch {
      setMessage('Failed to load translations.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  function openLocale(locale: string) {
    const existing = translations.find((t) => t.locale === locale);
    setDraft(existing?.content ?? {});
    setActiveLocale(locale);
  }

  function handleAddLocale() {
    const locale = newLocale.trim();
    if (!locale) return;
    setNewLocale('');
    openLocale(locale);
  }

  function setField(sectionKey: string, fieldKey: string, value: string) {
    setDraft((prev) => ({ ...prev, [sectionKey]: { ...(prev[sectionKey] ?? {}), [fieldKey]: value } }));
  }

  async function handleSave() {
    if (!accessToken || !activeLocale) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await saveTranslation(accessToken, activeLocale, draft);
      setMessage('Saved.');
      await refresh();
    } catch {
      setMessage('Failed to save translation.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(locale: string) {
    if (!accessToken) return;
    try {
      await deleteTranslation(accessToken, locale);
      if (activeLocale === locale) setActiveLocale(null);
      await refresh();
    } catch {
      setMessage('Failed to remove translation.');
    }
  }

  if (isLoading) {
    return <p className="p-8">Loading…</p>;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Languages</h1>
      <p className="max-w-lg text-sm text-muted">
        Add a translation for any field — visitors switch languages with a small picker on your page. Anything you
        leave blank falls back to your default-language content.
      </p>
      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {translations.map((t) => (
          <button
            key={t.locale}
            onClick={() => openLocale(t.locale)}
            className={`rounded-full border border-border-color px-3 py-1 text-sm ${activeLocale === t.locale ? 'bg-accent text-accent-foreground' : ''}`}
          >
            {t.locale}
          </button>
        ))}
        <input
          type="text"
          value={newLocale}
          onChange={(event) => setNewLocale(event.target.value)}
          placeholder="hi, ta, en-US…"
          className="w-28 rounded border border-border-color px-2 py-1 text-sm"
        />
        <button onClick={handleAddLocale} className="rounded border border-border-color px-3 py-1 text-sm">
          Add language
        </button>
      </div>

      {activeLocale && (
        <section className="flex max-w-lg flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Editing: {activeLocale}</h2>
            <button onClick={() => void handleDelete(activeLocale)} className="text-sm text-danger">
              Remove this language
            </button>
          </div>
          {DEFAULT_THEME_SCHEMA.sections.map((section) => (
            <fieldset key={section.key} className="flex flex-col gap-2 rounded border border-border-color p-3">
              <legend className="px-1 text-sm font-medium">{section.label}</legend>
              {section.fields
                .filter((field) => field.type === 'text' || field.type === 'richtext')
                .map((field) => (
                  <label key={field.key} className="flex flex-col gap-1 text-sm">
                    {field.label}
                    <input
                      type="text"
                      value={draft[section.key]?.[field.key] ?? ''}
                      onChange={(event) => setField(section.key, field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className="rounded border border-border-color px-3 py-2"
                    />
                  </label>
                ))}
            </fieldset>
          ))}
          <button
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save translation'}
          </button>
        </section>
      )}
    </main>
  );
}

export default function TranslationsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin']}>
      <TranslationsContent />
    </ProtectedRoute>
  );
}
