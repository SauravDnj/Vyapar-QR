'use client';

import { ThemeRenderer } from '@qrhub/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { AccordionSection } from '../../../components/ui/accordion';
import { PhoneFrame } from '../../../components/ui/phone-frame';
import { useAuth } from '../../../context/auth-context';
import {
  addGalleryImage,
  getOnboardingStatus,
  listThemes,
  removeGalleryImage,
  saveBusinessInfo,
  saveContactSection,
  saveMenuSection,
  saveSocialAndReview,
  selectTheme,
  uploadDocument,
  uploadImage,
  type OnboardingGalleryImage,
  type OnboardingStatus,
  type OnboardingTheme,
} from '../../../lib/onboarding-api';

import type { PublicSocialLink, SocialPlatform, ThemeContent } from '@qrhub/types';

interface HeroAboutForm {
  headline: string;
  tagline: string;
  logoUrl: string;
  backgroundImageUrl: string;
  description: string;
  address: string;
  hours: string;
  phone: string;
}

interface SocialRow {
  platform: SocialPlatform;
  value: string;
}

function LandingPageEditor() {
  const { accessToken } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [themes, setThemes] = useState<OnboardingTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingThemeId, setPendingThemeId] = useState<string | null>(null);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [heroAbout, setHeroAbout] = useState<HeroAboutForm>({
    headline: '',
    tagline: '',
    logoUrl: '',
    backgroundImageUrl: '',
    description: '',
    address: '',
    hours: '',
    phone: '',
  });
  const [socials, setSocials] = useState<SocialRow[]>([{ platform: 'whatsapp', value: '' }]);
  const [isSavingHero, setIsSavingHero] = useState(false);
  const [isSavingSocials, setIsSavingSocials] = useState(false);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [isSavingColor, setIsSavingColor] = useState(false);
  const [menuHeading, setMenuHeading] = useState('Menu');
  const [menuFileUrl, setMenuFileUrl] = useState('');
  const [isUploadingMenu, setIsUploadingMenu] = useState(false);
  const [isSavingMenu, setIsSavingMenu] = useState(false);
  const [galleryImages, setGalleryImages] = useState<OnboardingGalleryImage[]>([]);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [bookingUrl, setBookingUrl] = useState('');
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [onboardingStatus, themeList] = await Promise.all([getOnboardingStatus(accessToken), listThemes(accessToken)]);
      setStatus(onboardingStatus);
      setThemes(themeList);
      const content = onboardingStatus.landingPage?.contentJson ?? {};
      setHeroAbout({
        headline: content.hero?.headline ?? onboardingStatus.client?.businessName ?? '',
        tagline: content.hero?.tagline ?? '',
        logoUrl: content.hero?.logoUrl ?? '',
        backgroundImageUrl: content.hero?.backgroundImageUrl ?? '',
        description: content.about?.description ?? '',
        address: content.about?.address ?? '',
        hours: content.about?.hours ?? '',
        phone: content.about?.phone ?? '',
      });
      if (onboardingStatus.socialLinks.length > 0) {
        setSocials(onboardingStatus.socialLinks.map((link) => ({ platform: link.platform, value: link.value })));
      }
      setAccentColor(onboardingStatus.landingPage?.accentColor ?? null);
      setMenuHeading(content.menu?.heading || 'Menu');
      setMenuFileUrl(content.menu?.fileUrl ?? '');
      setGalleryImages(onboardingStatus.galleryImages);
      setBookingUrl(content.contact?.bookingUrl ?? '');
    } catch {
      setMessage('Failed to load your page.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleLogoUpload(file: File) {
    if (!accessToken) return;
    const url = await uploadImage(accessToken, file);
    setHeroAbout((prev) => ({ ...prev, logoUrl: url }));
  }

  async function handleBackgroundImageUpload(file: File) {
    if (!accessToken) return;
    const url = await uploadImage(accessToken, file);
    setHeroAbout((prev) => ({ ...prev, backgroundImageUrl: url }));
  }

  async function handleSaveHeroAbout() {
    if (!accessToken) return;
    setIsSavingHero(true);
    setMessage(null);
    try {
      await saveBusinessInfo(accessToken, {
        businessName: heroAbout.headline,
        tagline: heroAbout.tagline || undefined,
        logoUrl: heroAbout.logoUrl || undefined,
        backgroundImageUrl: heroAbout.backgroundImageUrl || undefined,
        description: heroAbout.description || undefined,
        address: heroAbout.address || undefined,
        hours: heroAbout.hours || undefined,
        phone: heroAbout.phone || undefined,
      });
      setMessage('Saved.');
      await refresh();
    } catch {
      setMessage('Failed to save.');
    } finally {
      setIsSavingHero(false);
    }
  }

  async function handleSaveSocials() {
    if (!accessToken) return;
    setIsSavingSocials(true);
    setMessage(null);
    try {
      await saveSocialAndReview(accessToken, { socialLinks: socials.filter((s) => s.value.trim() !== '') });
      setMessage('Saved.');
      await refresh();
    } catch {
      setMessage('Failed to save.');
    } finally {
      setIsSavingSocials(false);
    }
  }

  async function confirmThemeSwitch() {
    if (!accessToken || !pendingThemeId) return;
    setIsSavingTheme(true);
    try {
      await selectTheme(accessToken, pendingThemeId, accentColor);
      setPendingThemeId(null);
      await refresh();
    } finally {
      setIsSavingTheme(false);
    }
  }

  async function handleSaveColor() {
    if (!accessToken || !status?.landingPage?.themeId) return;
    setIsSavingColor(true);
    setMessage(null);
    try {
      await selectTheme(accessToken, status.landingPage.themeId, accentColor);
      setMessage('Saved.');
      await refresh();
    } catch {
      setMessage('Failed to save color.');
    } finally {
      setIsSavingColor(false);
    }
  }

  async function handleMenuUpload(file: File) {
    if (!accessToken) return;
    setIsUploadingMenu(true);
    setMessage(null);
    try {
      const url = await uploadDocument(accessToken, file);
      setMenuFileUrl(url);
    } catch {
      setMessage('Failed to upload — only PNG/JPEG/WEBP images or a PDF, up to 10MB.');
    } finally {
      setIsUploadingMenu(false);
    }
  }

  async function handleSaveMenu() {
    if (!accessToken) return;
    setIsSavingMenu(true);
    setMessage(null);
    try {
      await saveMenuSection(accessToken, { heading: menuHeading, fileUrl: menuFileUrl });
      setMessage('Saved.');
      await refresh();
    } catch {
      setMessage('Failed to save.');
    } finally {
      setIsSavingMenu(false);
    }
  }

  async function handleGalleryUpload(files: FileList) {
    if (!accessToken) return;
    setIsUploadingGallery(true);
    setMessage(null);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadImage(accessToken, file);
        const image = await addGalleryImage(accessToken, url);
        setGalleryImages((prev) => [...prev, image]);
      }
    } catch {
      setMessage('Failed to upload one or more photos.');
    } finally {
      setIsUploadingGallery(false);
    }
  }

  async function handleSaveBooking() {
    if (!accessToken) return;
    setIsSavingBooking(true);
    setMessage(null);
    try {
      await saveContactSection(accessToken, { bookingUrl: bookingUrl || undefined });
      setMessage('Saved.');
      await refresh();
    } catch {
      setMessage('Failed to save.');
    } finally {
      setIsSavingBooking(false);
    }
  }

  async function handleRemoveGalleryImage(id: string) {
    if (!accessToken) return;
    setGalleryImages((prev) => prev.filter((image) => image.id !== id));
    try {
      await removeGalleryImage(accessToken, id);
    } catch {
      setMessage('Failed to remove photo.');
      await refresh();
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  if (!status?.landingPage) {
    return <p>Finish onboarding before editing your page.</p>;
  }

  const activeThemeId = pendingThemeId ?? status.landingPage.themeId;
  const previewThemeName = themes.find((t) => t.id === activeThemeId)?.name ?? 'Minimal';

  const previewContent: ThemeContent = {
    ...status.landingPage.contentJson,
    hero: {
      headline: heroAbout.headline,
      tagline: heroAbout.tagline,
      logoUrl: heroAbout.logoUrl,
      backgroundImageUrl: heroAbout.backgroundImageUrl,
    },
    about: { description: heroAbout.description, address: heroAbout.address, hours: heroAbout.hours, phone: heroAbout.phone },
    menu: { heading: menuHeading, fileUrl: menuFileUrl },
    contact: { ...status.landingPage.contentJson.contact, bookingUrl },
  };
  const previewSocialLinks: PublicSocialLink[] = socials
    .filter((s) => s.value.trim() !== '')
    .map((s, index) => ({ id: `preview-${String(index)}`, platform: s.platform, value: s.value, displayOrder: index }));
  const previewReviewConfig = status.googleReviewConfig?.reviewLink
    ? { reviewLink: status.googleReviewConfig.reviewLink, avgRatingCached: null }
    : null;

  return (
    <>
      <h1 className="text-2xl font-semibold">My Landing Page</h1>
      {message && <p className="text-sm">{message}</p>}

      <div className="flex flex-wrap gap-2">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setPendingThemeId(theme.id)}
            className={`rounded-full border px-3 py-1 text-sm ${
              activeThemeId === theme.id ? 'border-accent bg-accent/10 text-accent' : 'border-border-color'
            }`}
          >
            {theme.name}
            {theme.id === status.landingPage?.themeId ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-color bg-surface p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
        <label className="flex items-center gap-2 text-sm font-medium">
          Theme color
          <input
            type="color"
            value={accentColor ?? '#0e7c66'}
            onChange={(e) => setAccentColor(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-md border border-border-color bg-transparent p-0.5"
          />
        </label>
        {accentColor ? (
          <button onClick={() => setAccentColor(null)} className="text-xs text-muted underline">
            Reset to theme default
          </button>
        ) : null}
        <button
          disabled={isSavingColor}
          onClick={() => void handleSaveColor()}
          className="ml-auto rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {isSavingColor ? 'Saving…' : 'Save color'}
        </button>
      </div>
      {pendingThemeId && pendingThemeId !== status.landingPage.themeId ? (
        <div className="flex max-w-md items-center gap-3 rounded-lg border border-warning bg-warning-bg p-3 text-sm text-warning">
          <p>Switching themes changes your layout — your content stays the same.</p>
          <button
            disabled={isSavingTheme}
            onClick={() => void confirmThemeSwitch()}
            className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
          >
            Confirm
          </button>
          <button onClick={() => setPendingThemeId(null)} className="rounded-md border border-border-color px-3 py-1 text-xs">
            Cancel
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-3">
          <AccordionSection title="Hero & company info" defaultOpen>
            <label className="flex flex-col gap-1 text-sm">
              Business name
              <input
                value={heroAbout.headline}
                onChange={(e) => setHeroAbout((prev) => ({ ...prev, headline: e.target.value }))}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tagline
              <input
                value={heroAbout.tagline}
                onChange={(e) => setHeroAbout((prev) => ({ ...prev, tagline: e.target.value }))}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Logo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleLogoUpload(file);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Background image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleBackgroundImageUpload(file);
                }}
              />
              {heroAbout.backgroundImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroAbout.backgroundImageUrl}
                  alt="Background preview"
                  className="mt-1 h-24 w-full rounded-md object-cover"
                />
              )}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Description
              <textarea
                value={heroAbout.description}
                onChange={(e) => setHeroAbout((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Address
              <input
                value={heroAbout.address}
                onChange={(e) => setHeroAbout((prev) => ({ ...prev, address: e.target.value }))}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Business hours
              <input
                value={heroAbout.hours}
                onChange={(e) => setHeroAbout((prev) => ({ ...prev, hours: e.target.value }))}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Phone
              <input
                value={heroAbout.phone}
                onChange={(e) => setHeroAbout((prev) => ({ ...prev, phone: e.target.value }))}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <button
              disabled={isSavingHero}
              onClick={() => void handleSaveHeroAbout()}
              className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {isSavingHero ? 'Saving…' : 'Save'}
            </button>
          </AccordionSection>

          <AccordionSection title="Menu / Brochure">
            <p className="text-xs text-muted">
              Upload a photo of your menu or a brochure PDF — shown as a scrollable image if it&apos;s a photo, or a
              &quot;View menu&quot; link if it&apos;s a PDF.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              Section heading
              <input
                value={menuHeading}
                onChange={(e) => setMenuHeading(e.target.value)}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              File (image or PDF, up to 10MB)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleMenuUpload(file);
                }}
              />
            </label>
            {isUploadingMenu && <p className="text-xs text-muted">Uploading…</p>}
            {menuFileUrl && !isUploadingMenu && (
              <p className="text-xs text-success">File uploaded — save to publish it.</p>
            )}
            <button
              disabled={isSavingMenu}
              onClick={() => void handleSaveMenu()}
              className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {isSavingMenu ? 'Saving…' : 'Save'}
            </button>
          </AccordionSection>

          <AccordionSection title="Gallery">
            <p className="text-xs text-muted">Upload photos of your space, products, or work — shown as a photo grid on your page.</p>
            <label className="flex flex-col gap-1 text-sm">
              Add photos
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={isUploadingGallery}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) void handleGalleryUpload(files);
                  e.target.value = '';
                }}
              />
            </label>
            {isUploadingGallery && <p className="text-xs text-muted">Uploading…</p>}
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {galleryImages.map((image) => (
                  <div key={image.id} className="group relative aspect-square overflow-hidden rounded-md border border-border-color">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => void handleRemoveGalleryImage(image.id)}
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted">{galleryImages.length} / 20 photos. Changes save immediately — no extra &quot;Save&quot; step.</p>
          </AccordionSection>

          <AccordionSection title="Locations">
            <p className="text-sm text-muted">
              {status.locations.length} location{status.locations.length === 1 ? '' : 's'} added.
            </p>
            <Link href="/dashboard/locations" className="w-fit text-sm text-accent underline">
              Manage locations →
            </Link>
          </AccordionSection>

          <AccordionSection title="Booking / appointments">
            <p className="text-xs text-muted">Add a booking link (Calendly, etc.) to show a &quot;Book an appointment&quot; button on your page.</p>
            <label className="flex flex-col gap-1 text-sm">
              Booking link
              <input
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="https://calendly.com/your-business"
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <button
              disabled={isSavingBooking}
              onClick={() => void handleSaveBooking()}
              className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {isSavingBooking ? 'Saving…' : 'Save'}
            </button>
          </AccordionSection>

          <AccordionSection title="Payment options">
            <p className="text-sm text-muted">
              {status.paymentMethods.length} method{status.paymentMethods.length === 1 ? '' : 's'} configured.
            </p>
            <Link href="/dashboard/payment-methods" className="w-fit text-sm text-accent underline">
              Manage payment methods →
            </Link>
          </AccordionSection>

          <AccordionSection title="Reviews">
            <p className="text-sm text-muted">
              {status.googleReviewConfig?.reviewLink ? 'Google review link connected.' : 'Not connected yet.'}
            </p>
            <Link href="/dashboard/reviews" className="w-fit text-sm text-accent underline">
              Manage Google Reviews →
            </Link>
          </AccordionSection>

          <AccordionSection title="Testimonials">
            <p className="text-sm text-muted">Approve visitor-submitted quotes to show them on your page.</p>
            <Link href="/dashboard/testimonials" className="w-fit text-sm text-accent underline">
              Manage testimonials →
            </Link>
          </AccordionSection>

          <AccordionSection title="Loyalty program">
            <p className="text-sm text-muted">Set up a digital stamp card for repeat customers.</p>
            <Link href="/dashboard/loyalty" className="w-fit text-sm text-accent underline">
              Manage loyalty program →
            </Link>
          </AccordionSection>

          <AccordionSection title="Social links">
            {socials.map((social, index) => (
              <div key={index} className="flex gap-2">
                <select
                  value={social.platform}
                  onChange={(e) =>
                    setSocials((prev) => prev.map((s, i) => (i === index ? { ...s, platform: e.target.value as SocialPlatform } : s)))
                  }
                  className="rounded-md border border-border-color px-2 py-2 text-sm"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                </select>
                <input
                  placeholder="Number or handle"
                  value={social.value}
                  onChange={(e) => setSocials((prev) => prev.map((s, i) => (i === index ? { ...s, value: e.target.value } : s)))}
                  className="flex-1 rounded-md border border-border-color px-3 py-2 text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSocials((prev) => [...prev, { platform: 'whatsapp', value: '' }])}
              className="w-fit rounded-md border border-border-color px-3 py-1 text-xs"
            >
              + Add another link
            </button>
            <button
              disabled={isSavingSocials}
              onClick={() => void handleSaveSocials()}
              className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {isSavingSocials ? 'Saving…' : 'Save'}
            </button>
          </AccordionSection>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <PhoneFrame>
            <ThemeRenderer
              themeName={previewThemeName}
              businessName={heroAbout.headline || 'Your Business'}
              content={previewContent}
              paymentMethods={status.paymentMethods}
              socialLinks={previewSocialLinks}
              reviewConfig={previewReviewConfig}
              accentColor={accentColor}
              galleryImages={galleryImages.map((image) => ({ id: image.id, imageUrl: image.imageUrl, displayOrder: image.displayOrder }))}
              locations={status.locations}
            />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}

export default function LandingPagePage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <LandingPageEditor />
    </ProtectedRoute>
  );
}
