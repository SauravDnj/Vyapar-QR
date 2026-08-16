'use client';

import { DEFAULT_THEME_SCHEMA } from '@qrhub/types';
import { ThemeRenderer } from '@qrhub/ui';
import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../components/protected-route';
import { useAuth } from '../../context/auth-context';
import {
  completeOnboarding,
  draftBusinessCopy,
  getOnboardingStatus,
  listThemes,
  saveBusinessInfo,
  savePaymentMethods,
  saveSocialAndReview,
  selectTheme,
  uploadImage,
  type OnboardingStatus,
  type OnboardingTheme,
} from '../../lib/onboarding-api';

import type { PaymentMethodType, SocialPlatform, ThemeContent, ThemeField, ThemeSectionKey } from '@qrhub/types';

type Step = 'business' | 'theme' | 'payment' | 'social' | 'done';
const STEPS: { key: Step; label: string }[] = [
  { key: 'business', label: 'Business info' },
  { key: 'theme', label: 'Theme' },
  { key: 'payment', label: 'Payment' },
  { key: 'social', label: 'Social & reviews' },
  { key: 'done', label: 'Done' },
];

/** Business info is collected before a theme is chosen, so it's driven by the
 * schema every starter theme shares (packages/types) rather than a fixed
 * form — adding a field to the schema shows up here with no code change. */
const PRE_THEME_SECTIONS = DEFAULT_THEME_SCHEMA.sections.filter((s) => s.key === 'hero' || s.key === 'about');

function SchemaField({
  field,
  value,
  onChange,
  onImageUpload,
}: {
  field: ThemeField;
  value: string;
  onChange: (value: string) => void;
  onImageUpload?: (file: File) => void;
}) {
  if (field.type === 'richtext') {
    return (
      <textarea
        placeholder={field.placeholder ?? field.label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border-color px-3 py-2"
      />
    );
  }
  if (field.type === 'image') {
    return (
      <label className="flex flex-col gap-1 text-sm text-gray-600">
        {field.label}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImageUpload?.(file);
          }}
        />
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={field.label} className="h-16 w-16 rounded-full object-cover" />
        ) : null}
      </label>
    );
  }
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value === 'true'} onChange={(e) => onChange(String(e.target.checked))} />
        {field.label}
      </label>
    );
  }
  return (
    <input
      required={field.required}
      placeholder={field.placeholder ?? field.label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-border-color px-3 py-2"
    />
  );
}

interface PaymentRow {
  type: PaymentMethodType;
  upiId: string;
  qrImageUrl: string;
}

interface SocialRow {
  platform: SocialPlatform;
  value: string;
}

function StepBar({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex gap-2 text-sm">
      {STEPS.map((step, index) => (
        <li
          key={step.key}
          className={`rounded-full px-3 py-1 ${
            index === currentIndex
              ? 'bg-accent text-accent-foreground'
              : index < currentIndex
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-gray-100 text-muted'
          }`}
        >
          {index + 1}. {step.label}
        </li>
      ))}
    </ol>
  );
}

function OnboardingWizard() {
  const { accessToken } = useAuth();
  const [step, setStep] = useState<Step>('business');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);

  const [sectionValues, setSectionValues] = useState<ThemeContent>({});
  const [themes, setThemes] = useState<OnboardingTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([{ type: 'gpay', upiId: '', qrImageUrl: '' }]);
  const [socials, setSocials] = useState<SocialRow[]>([{ platform: 'whatsapp', value: '' }]);
  const [reviewLink, setReviewLink] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [result, setResult] = useState<{ landingUrl: string; qrImageUrl: string | null } | null>(null);

  const applyStatus = useCallback((status: OnboardingStatus) => {
    if (status.landingPage?.contentJson) {
      setSectionValues((prev) => ({ ...prev, ...status.landingPage!.contentJson }));
    }
    if (status.landingPage?.themeId) {
      setSelectedThemeId(status.landingPage.themeId);
    }
    if (status.paymentMethods.length > 0) {
      setPayments(status.paymentMethods.map((m) => ({ type: m.type, upiId: m.upiId ?? '', qrImageUrl: m.qrImageUrl ?? '' })));
    }
    if (status.socialLinks.length > 0) {
      setSocials(status.socialLinks.map((s) => ({ platform: s.platform, value: s.value })));
    }
    if (status.googleReviewConfig?.reviewLink) setReviewLink(status.googleReviewConfig.reviewLink);
    if (status.googleReviewConfig?.sheetId) setSheetId(status.googleReviewConfig.sheetId);
    setStep(status.nextStep);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        const [status, themeList] = await Promise.all([getOnboardingStatus(accessToken), listThemes(accessToken)]);
        setThemes(themeList);
        applyStatus(status);
      } catch {
        setError('Failed to load onboarding status.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, applyStatus]);

  function setFieldValue(sectionKey: ThemeSectionKey, fieldKey: string, value: string) {
    setSectionValues((prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], [fieldKey]: value } }));
  }

  async function handleSectionImageUpload(sectionKey: ThemeSectionKey, fieldKey: string, file: File) {
    if (!accessToken) return;
    try {
      const url = await uploadImage(accessToken, file);
      setFieldValue(sectionKey, fieldKey, url);
    } catch {
      setError('Image upload failed.');
    }
  }

  async function handleQrUpload(index: number, file: File) {
    if (!accessToken) return;
    try {
      const url = await uploadImage(accessToken, file);
      setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, qrImageUrl: url } : p)));
    } catch {
      setError('QR image upload failed.');
    }
  }

  async function handleAiDraft() {
    if (!accessToken) return;
    const businessName = sectionValues.hero?.headline?.trim();
    if (!businessName) {
      setError('Enter a business name first.');
      return;
    }
    setIsDrafting(true);
    setError(null);
    try {
      const draft = await draftBusinessCopy(accessToken, businessName);
      if (!draft) {
        setError('AI drafting is not configured on this deployment — write it yourself instead.');
        return;
      }
      setFieldValue('hero', 'tagline', draft.tagline);
      setFieldValue('about', 'description', draft.description);
    } catch {
      setError('Failed to generate a draft.');
    } finally {
      setIsDrafting(false);
    }
  }

  async function handleBusinessSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    const hero = sectionValues.hero ?? {};
    const about = sectionValues.about ?? {};
    if (!hero.headline?.trim()) {
      setError('Business name is required.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await saveBusinessInfo(accessToken, {
        businessName: hero.headline,
        tagline: hero.tagline,
        logoUrl: hero.logoUrl,
        description: about.description,
        address: about.address,
        hours: about.hours,
        phone: about.phone,
        agencySlug: sessionStorage.getItem('qrhub_agency_slug') ?? undefined,
      });
      setStep('theme');
    } catch {
      setError('Failed to save business info.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleThemeSubmit() {
    if (!accessToken || !selectedThemeId) return;
    setError(null);
    setIsSaving(true);
    try {
      await selectTheme(accessToken, selectedThemeId);
      setStep('payment');
    } catch {
      setError('Failed to save theme.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePaymentSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    const methods = payments
      .filter((p) => p.upiId || p.qrImageUrl)
      .map((p) => ({ type: p.type, upiId: p.upiId || undefined, qrImageUrl: p.qrImageUrl || undefined }));
    if (methods.length === 0) {
      setError('Add at least one payment method (UPI ID or QR image).');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await savePaymentMethods(accessToken, methods);
      setStep('social');
    } catch {
      setError('Failed to save payment methods.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSocialSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setError(null);
    setIsSaving(true);
    try {
      await saveSocialAndReview(accessToken, {
        socialLinks: socials.filter((s) => s.value.trim() !== ''),
        reviewLink: reviewLink || undefined,
        sheetId: sheetId || undefined,
      });
      const { landingUrl, qrImageUrl } = await completeOnboarding(accessToken);
      setResult({ landingUrl, qrImageUrl });
      setStep('done');
    } catch {
      setError('Failed to publish your page.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="p-8">Loading…</p>;
  }

  let businessName = 'Your Business';
  if (sectionValues.hero?.headline?.trim()) {
    businessName = sectionValues.hero.headline;
  }
  const selectedThemeName = themes.find((t) => t.id === selectedThemeId)?.name ?? null;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Set up your page</h1>
      <StepBar current={step} />
      {error && <p className="text-sm text-danger">{error}</p>}

      {step === 'business' && (
        <form onSubmit={(e) => void handleBusinessSubmit(e)} className="flex max-w-md flex-col gap-5">
          {PRE_THEME_SECTIONS.map((section) => (
            <fieldset key={section.key} className="flex flex-col gap-3">
              <legend className="text-xs font-medium uppercase text-muted">{section.label}</legend>
              {section.fields.map((field) => (
                <SchemaField
                  key={field.key}
                  field={field}
                  value={sectionValues[section.key]?.[field.key] ?? ''}
                  onChange={(value) => setFieldValue(section.key, field.key, value)}
                  onImageUpload={
                    field.type === 'image' ? (file) => void handleSectionImageUpload(section.key, field.key, file) : undefined
                  }
                />
              ))}
            </fieldset>
          ))}
          <button
            type="button"
            disabled={isDrafting}
            onClick={() => void handleAiDraft()}
            className="w-fit rounded-md border border-border-color px-4 py-2 text-sm text-accent disabled:opacity-50"
          >
            {isDrafting ? 'Generating…' : 'Generate tagline & description with AI'}
          </button>
          <button disabled={isSaving} type="submit" className="w-fit rounded-md bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50">
            Next
          </button>
        </form>
      )}

      {step === 'theme' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Object.entries(
              themes.reduce<Record<string, OnboardingTheme[]>>((acc, t) => {
                (acc[t.category] ??= []).push(t);
                return acc;
              }, {}),
            ).map(([category, categoryThemes]) => (
              <div key={category} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase text-muted">{category}</h3>
                {categoryThemes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedThemeId(theme.id)}
                    className={`rounded border border-border-color px-4 py-3 text-left ${selectedThemeId === theme.id ? 'border-black ring-2 ring-black' : ''}`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {selectedThemeName ? (
            <div className="max-h-[600px] overflow-y-auto rounded border border-border-color">
              <ThemeRenderer
                themeName={selectedThemeName}
                businessName={businessName}
                content={sectionValues}
                paymentMethods={[]}
                socialLinks={[]}
                reviewConfig={null}
              />
            </div>
          ) : null}

          <button
            disabled={isSaving || !selectedThemeId}
            onClick={() => void handleThemeSubmit()}
            className="w-fit rounded-md bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {step === 'payment' && (
        <form onSubmit={(e) => void handlePaymentSubmit(e)} className="flex max-w-md flex-col gap-4">
          {payments.map((payment, index) => (
            <div key={index} className="flex flex-col gap-2 rounded border border-border-color p-3">
              <select
                value={payment.type}
                onChange={(e) =>
                  setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, type: e.target.value as PaymentMethodType } : p)))
                }
                className="rounded border border-border-color px-3 py-2"
              >
                <option value="gpay">Google Pay</option>
                <option value="phonepe">PhonePe</option>
                <option value="paytm">Paytm</option>
                <option value="other">Other</option>
              </select>
              <input
                placeholder="UPI ID (e.g. business@okhdfcbank) — optional"
                value={payment.upiId}
                onChange={(e) => setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, upiId: e.target.value } : p)))}
                className="rounded border border-border-color px-3 py-2"
              />
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                QR image — optional if UPI ID is set
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleQrUpload(index, file);
                  }}
                />
              </label>
              {payments.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPayments((prev) => prev.filter((_, i) => i !== index))}
                  className="w-fit text-sm text-danger"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPayments((prev) => [...prev, { type: 'gpay', upiId: '', qrImageUrl: '' }])}
            className="w-fit rounded border border-border-color px-3 py-1 text-sm"
          >
            + Add another method
          </button>
          <button disabled={isSaving} type="submit" className="w-fit rounded-md bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50">
            Next
          </button>
        </form>
      )}

      {step === 'social' && (
        <form onSubmit={(e) => void handleSocialSubmit(e)} className="flex max-w-md flex-col gap-4">
          {socials.map((social, index) => (
            <div key={index} className="flex gap-2">
              <select
                value={social.platform}
                onChange={(e) =>
                  setSocials((prev) => prev.map((s, i) => (i === index ? { ...s, platform: e.target.value as SocialPlatform } : s)))
                }
                className="rounded border border-border-color px-3 py-2"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
              <input
                placeholder="Number or handle"
                value={social.value}
                onChange={(e) => setSocials((prev) => prev.map((s, i) => (i === index ? { ...s, value: e.target.value } : s)))}
                className="flex-1 rounded border border-border-color px-3 py-2"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSocials((prev) => [...prev, { platform: 'whatsapp', value: '' }])}
            className="w-fit rounded border border-border-color px-3 py-1 text-sm"
          >
            + Add another link
          </button>
          <input
            placeholder="Google review link"
            value={reviewLink}
            onChange={(e) => setReviewLink(e.target.value)}
            className="rounded border border-border-color px-3 py-2"
          />
          <input
            placeholder="Google Sheet ID (optional)"
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            className="rounded border border-border-color px-3 py-2"
          />
          <button disabled={isSaving} type="submit" className="w-fit rounded-md bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50">
            Publish my page
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-4 rounded border border-border-color p-8 text-center">
          <p className="text-lg font-medium">Your page is live 🎉</p>
          {result?.landingUrl && (
            <a href={result.landingUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
              {result.landingUrl}
            </a>
          )}
          {result?.qrImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.qrImageUrl} alt="Your QR code" className="h-48 w-48" />
          )}
          <a href="/dashboard" className="rounded-md bg-accent px-4 py-2 text-accent-foreground">
            Go to dashboard
          </a>
        </div>
      )}
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <OnboardingWizard />
    </ProtectedRoute>
  );
}
