'use client';

import { Icon } from '../icon';

import { readableOn } from './screen/model';
import { Logo, paymentAppsLine, Stars, ThemeAssets } from './screen/parts';
import { ActionIcon, actionIcon, ScreenAction, ScreenSheet, useScreen } from './screen/screen';

import type { PublicGalleryImage, ThemeRenderProps } from '@vyaparqr/types';
import type { CSSProperties } from 'react';

/** Warm 22-carat gold rather than the flatter #A16207 the palette suggests:
 * on a near-black ground that darker gold reads brown, and jewellery is sold
 * on the colour of the metal. */
const GOLD = '#d9b166';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600&display=swap';

/** Photos behind the hero, cross-faded. Three is enough to feel alive without
 * making a QR-scanned page download a gallery before it renders. */
const BACKDROP_COUNT = 3;

/**
 * Zevar — a jewellery showroom on one screen.
 *
 * Built on the skill's luxury-retail direction: Cormorant over Montserrat,
 * near-black with a gold accent, glass surfaces, staggered entrances. The
 * theme's own decisions are the jewellery-specific ones — the client's own
 * pieces cross-fade behind the hero, a gold halo turns around the logo, the
 * name is struck in foil, and a collection rail puts the stock one tap away,
 * because in this trade the product *is* the marketing.
 *
 * Everything sits above a scrim: the photos are client-uploaded, so the ivory
 * text needs a guaranteed contrast floor rather than luck with a bright image.
 */
const CSS = `
.qs-zevar{--qs-display:"Cormorant",ui-serif,Georgia,serif;--qs-body:"Montserrat",ui-sans-serif,system-ui,sans-serif;--zv-line:color-mix(in srgb,var(--t-accent) 30%,transparent);--zv-glass:rgb(255 250 240/.06)}
.zv-art{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:radial-gradient(120% 70% at 50% 0%,#2b1418 0%,transparent 58%),radial-gradient(90% 60% at 50% 100%,#1b1210 0%,transparent 60%),var(--t-bg)}
.zv-shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;animation:zv-cross 21s ease-in-out infinite}
.zv-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgb(16 11 10/.62) 0%,rgb(16 11 10/.78) 46%,rgb(16 11 10/.94) 82%,var(--t-bg) 100%)}
@keyframes zv-cross{0%{opacity:0;transform:scale(1.04)}6%{opacity:.5}28%{opacity:.5}34%{opacity:0;transform:scale(1.12)}100%{opacity:0;transform:scale(1.04)}}
.zv-glow{position:absolute;left:50%;top:14%;width:340px;height:340px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--t-accent) 22%,transparent),transparent 68%);animation:zv-breathe 8s ease-in-out infinite}
@keyframes zv-breathe{0%,100%{opacity:.7;transform:translateX(-50%) scale(1)}50%{opacity:1;transform:translateX(-50%) scale(1.1)}}
.zv-sparkle{position:absolute;color:#fff6df;opacity:0;animation:zv-twinkle 5.5s ease-in-out infinite}
@keyframes zv-twinkle{0%,88%,100%{opacity:0;transform:scale(.4) rotate(0deg)}94%{opacity:.95;transform:scale(1) rotate(22deg)}}
.zv-chip{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 13px;border:1px solid var(--zv-line);border-radius:999px;background:var(--zv-glass);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-size:12px;letter-spacing:.02em;color:var(--t-muted);max-width:64%}
.zv-icon-btn{display:grid;place-items:center;width:44px;height:44px;border-radius:999px;border:1px solid var(--zv-line);background:var(--zv-glass);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--t-text)}
.zv-halo{position:relative;display:grid;place-items:center;width:calc(var(--qs-logo) + 30px);height:calc(var(--qs-logo) + 30px)}
.zv-halo::before{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 8%,color-mix(in srgb,var(--t-accent) 70%,transparent) 22%,#fff3d4 30%,color-mix(in srgb,var(--t-accent) 70%,transparent) 38%,transparent 56% 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 1.5px),#000 calc(100% - 1px));mask:radial-gradient(farthest-side,transparent calc(100% - 1.5px),#000 calc(100% - 1px));animation:qs-spin 11s linear infinite}
.zv-halo::after{content:"";position:absolute;inset:9px;border-radius:50%;border:1px solid color-mix(in srgb,var(--t-accent) 22%,transparent)}
.zv-logo{width:var(--qs-logo);height:var(--qs-logo);border-radius:50%;overflow:hidden;background:radial-gradient(120% 120% at 30% 20%,#241a14,#0d0908);box-shadow:0 20px 50px -14px color-mix(in srgb,var(--t-accent) 55%,transparent),inset 0 0 0 1px var(--zv-line);font-family:var(--qs-display);font-weight:600;font-size:calc(var(--qs-logo) * .4);color:var(--t-accent)}
.zv-eyebrow{display:flex;align-items:center;gap:10px;font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--t-accent)}
.zv-eyebrow::before,.zv-eyebrow::after{content:"";width:26px;height:1px;background:linear-gradient(90deg,transparent,var(--t-accent))}
.zv-eyebrow::after{transform:scaleX(-1)}
.zv-name{font-family:var(--qs-display);font-weight:600;font-size:clamp(34px,12cqw,50px);line-height:1;letter-spacing:.005em;background:linear-gradient(100deg,#fbf3e4 0 38%,#fff8e6 46%,var(--t-accent) 52%,#fbf3e4 62% 100%);background-size:250% 100%;background-position:100% 0;-webkit-background-clip:text;background-clip:text;color:transparent;animation:qs-rise .8s cubic-bezier(.16,1,.3,1) both,zv-foil 7s ease-in-out 1.5s infinite;animation-delay:.22s,1.5s}
@keyframes zv-foil{0%,58%{background-position:100% 0}100%{background-position:-55% 0}}
.zv-tagline{font-size:14px;line-height:1.55;color:var(--t-muted)}
.zv-rail{display:flex;gap:9px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none;padding:1px}
.zv-rail::-webkit-scrollbar{display:none}
.zv-thumb{position:relative;flex:0 0 auto;width:66px;height:66px;border-radius:15px;overflow:hidden;scroll-snap-align:start;border:1px solid var(--zv-line);box-shadow:0 8px 20px -12px #000}
.zv-thumb img{width:100%;height:100%;object-fit:cover}
.zv-thumb-more{display:grid;place-items:center;gap:2px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--t-accent);background:var(--zv-glass)}
.zv-cta{display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:8px 10px 8px 22px;border-radius:16px;color:var(--t-accent-text);background:linear-gradient(115deg,color-mix(in srgb,var(--t-accent) 72%,#fff3d4) 0%,var(--t-accent) 42%,color-mix(in srgb,var(--t-accent) 62%,#6b4a12) 100%);box-shadow:0 18px 42px -16px color-mix(in srgb,var(--t-accent) 75%,transparent),inset 0 1px 0 rgb(255 255 255/.45)}
.zv-cta-icon{margin-left:auto;display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:color-mix(in srgb,var(--t-accent-text) 90%,transparent);color:var(--t-accent)}
.zv-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:78px;border-radius:16px;border:1px solid var(--zv-line);background:var(--zv-glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--t-text);font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase}
.zv-tile-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:999px;color:var(--t-accent);background:color-mix(in srgb,var(--t-accent) 13%,transparent)}
.zv-dock{display:flex;border-top:1px solid var(--zv-line);padding-top:2px}
.zv-dock-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:54px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--t-muted);font-family:var(--qs-body)}
.zv-dock-btn svg{color:var(--t-accent)}
.zv-dock-btn:active{color:var(--t-text)}
.zv-brand{font-size:9px;letter-spacing:.26em;text-transform:uppercase;color:color-mix(in srgb,var(--t-muted) 62%,transparent);text-align:center}
@container qs (max-height:700px){.zv-thumb{width:56px;height:56px}.zv-cta{min-height:54px}}
@container qs (max-height:640px){.zv-tile{min-height:64px;gap:4px}.zv-tile-icon{width:32px;height:32px}}
`;

/** A four-point sparkle — the glint a cut stone throws. */
function Sparkle({ style }: { style: CSSProperties }) {
  return (
    <svg className="zv-sparkle" style={style} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0c.7 6.4 4.9 10.6 12 12-7.1 1.4-11.3 5.6-12 12-.7-6.4-4.9-10.6-12-12C7.1 10.6 11.3 6.4 12 0Z" fill="currentColor" />
    </svg>
  );
}

export function ZevarTheme(props: ThemeRenderProps) {
  const screen = useScreen(props);
  const { model, dock } = screen;
  const accent = props.accentColor ?? GOLD;
  const gallery: PublicGalleryImage[] = [...(props.galleryImages ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const backdrops = gallery.slice(0, BACKDROP_COUNT);

  const rootStyle = {
    '--t-bg': '#100b0a',
    '--t-text': '#f7efe2',
    '--t-muted': '#c3b3a0',
    '--t-accent': accent,
    '--t-accent-text': readableOn(accent),
    '--t-border': 'color-mix(in srgb, var(--t-accent) 30%, transparent)',
    '--t-radius': '14px',
    '--qs-sheet-bg': '#fffaf2',
    '--qs-sheet-text': '#1c1917',
    '--qs-sheet-muted': '#57534e',
    '--qs-sheet-border': '#ece0cd',
  } as CSSProperties;

  return (
    <div className="qs-root qs-zevar" style={rootStyle}>
      <ThemeAssets id="zevar" css={CSS} fontsHref={FONTS} />

      <div className="zv-art" aria-hidden="true">
        {backdrops.map((image, index) => (
          <img
            key={image.id}
            src={image.imageUrl}
            alt=""
            className="zv-shot"
            loading="lazy"
            decoding="async"
            style={{ animationDelay: `${String(index * 7)}s` }}
          />
        ))}
        <span className="zv-scrim" />
        <span className="zv-glow" />
        <Sparkle style={{ left: '16%', top: '20%' }} />
        <Sparkle style={{ right: '18%', top: '28%', animationDelay: '1.8s' }} />
        <Sparkle style={{ left: '24%', top: '44%', animationDelay: '3.4s' }} />
      </div>

      <div className="qs-frame">
        <header className="qs-rise flex items-center justify-between gap-3" style={{ '--i': 0 } as CSSProperties}>
          {model.hours ? (
            <span className="zv-chip">
              <Icon name="clock" className="size-3.5 shrink-0" style={{ color: 'var(--t-accent)' }} />
              <span className="truncate">{model.hours}</span>
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" aria-label="Share" className="zv-icon-btn qs-press" onClick={() => void screen.share()}>
              <Icon name="share" className="size-[18px]" />
            </button>
            <button type="button" aria-label="Save contact" className="zv-icon-btn qs-press" onClick={screen.saveContact}>
              <Icon name="user-plus" className="size-[18px]" />
            </button>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-3 text-center">
          <div className="zv-halo qs-rise" style={{ '--i': 1 } as CSSProperties}>
            <div className="zv-logo">
              <Logo url={model.logoUrl} initials={model.initials} />
            </div>
          </div>

          {model.rating ? (
            <Stars rating={model.rating} className="qs-rise qs-hide-tiny text-[13px] text-[var(--t-accent)]" />
          ) : (
            <span className="zv-eyebrow qs-rise qs-hide-tiny" style={{ '--i': 2 } as CSSProperties}>
              Fine jewellery
            </span>
          )}

          <h1 className="zv-name qs-clamp-2 px-2">{model.headline}</h1>

          {model.tagline ? (
            <p className="zv-tagline qs-tagline qs-clamp-2 qs-rise max-w-[32ch]" style={{ '--i': 3 } as CSSProperties}>
              {model.tagline}
            </p>
          ) : null}

          {model.address ? (
            <p
              className="zv-tagline qs-rise qs-hide-short flex max-w-full items-center gap-1.5 text-[13px]"
              style={{ '--i': 4 } as CSSProperties}
            >
              <Icon name="map-pin" className="size-3.5 shrink-0" style={{ color: 'var(--t-accent)' }} />
              <span className="truncate">{model.address}</span>
            </p>
          ) : null}
        </section>

        <div className="flex flex-col gap-3">
          {gallery.length > 0 ? (
            <div className="qs-rise qs-hide-short" style={{ '--i': 5 } as CSSProperties}>
              <nav aria-label="Collection" className="zv-rail">
                {gallery.slice(0, 8).map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    className="zv-thumb qs-press"
                    aria-label="Open the collection"
                    onClick={() => {
                      screen.open('gallery');
                    }}
                  >
                    <img src={image.imageUrl} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
                <button
                  type="button"
                  className="zv-thumb zv-thumb-more qs-press"
                  onClick={() => {
                    screen.open('gallery');
                  }}
                >
                  <Icon name="image" className="size-4" />
                  All
                </button>
              </nav>
            </div>
          ) : null}

          <div className="qs-rise" style={{ '--i': 6 } as CSSProperties}>
            {model.primary ? (
              <button
                type="button"
                className="zv-cta qs-sheen qs-press text-left"
                onClick={() => {
                  screen.open('pay');
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[17px] leading-tight font-semibold">{model.primary.label}</span>
                  <span className="truncate text-xs opacity-75">{paymentAppsLine(props.paymentMethods)}</span>
                </span>
                <span className="zv-cta-icon">
                  <Icon name="rupee" className="size-5" />
                </span>
              </button>
            ) : (
              <button type="button" className="zv-cta qs-sheen qs-press text-left" onClick={screen.saveContact}>
                <span className="text-[17px] font-semibold">Save contact</span>
                <span className="zv-cta-icon">
                  <Icon name="user-plus" className="size-5" />
                </span>
              </button>
            )}
          </div>

          {model.actions.length > 0 ? (
            <nav
              aria-label="Quick actions"
              className="grid gap-2.5"
              style={{ gridTemplateColumns: `repeat(${String(model.actions.length)}, minmax(0, 1fr))` }}
            >
              {model.actions.map((action, index) => (
                <ScreenAction
                  key={action.id}
                  action={action}
                  screen={screen}
                  slug={props.slug}
                  businessName={props.businessName}
                  className="zv-tile qs-pop qs-press"
                  style={{ '--i': index } as CSSProperties}
                >
                  <span className="zv-tile-icon">
                    <ActionIcon icon={actionIcon(action)} className="size-[18px]" />
                  </span>
                  {action.label}
                </ScreenAction>
              ))}
            </nav>
          ) : null}

          {dock.length > 0 ? (
            <nav aria-label="Sections" className="zv-dock qs-rise" style={{ '--i': 8 } as CSSProperties}>
              {dock.map((info) => (
                <button
                  key={info.key}
                  type="button"
                  className="zv-dock-btn qs-press"
                  onClick={() => {
                    screen.open(info.key);
                  }}
                >
                  <Icon name={info.icon} className="size-[18px]" />
                  <span className="max-w-full truncate px-1">{info.label}</span>
                </button>
              ))}
            </nav>
          ) : null}

          {props.hideBranding ? null : <p className="zv-brand qs-hide-short">Powered by Vyapar QR</p>}
        </div>
      </div>

      <ScreenSheet screen={screen} props={props} />
    </div>
  );
}
