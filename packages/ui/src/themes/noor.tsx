'use client';

import { PlatformLogo } from '../brand-logos';
import { Icon } from '../icon';

import { readableOn } from './screen/model';
import { Logo, Stars, ThemeAssets } from './screen/parts';
import { ActionIcon, actionIcon, ScreenAction, ScreenSheet, useScreen } from './screen/screen';

import type { BrandName } from '../brand-logos';
import type { PublicGalleryImage, ThemeRenderProps } from '@vyaparqr/types';
import type { CSSProperties } from 'react';

/** Gold that works on white. The dark theme needed a bright 22-carat #d9b166
 * to read against near-black; on white that same gold is barely there. This is
 * the deeper ramp of the same metal — 4.9:1 against white, so it can carry
 * text as well as decoration. */
const GOLD = '#a16207';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600&display=swap';

/** Pieces on the rail before the "All" tile takes over. */
const RAIL_LIMIT = 8;

/** Above this many quick actions the grid stretches to fill the width; below
 * it, fixed-width tiles are centred instead. */
const ACTION_COLUMNS = 4;

/**
 * Noor — a jewellery counter in daylight.
 *
 * "Noor" is light, which is both the theme and the point: jewellery is graded
 * under white light, and a white page is how a shop actually shows a piece.
 * This replaces Zevar, which put the same business on near-black behind its
 * own photographs. Same single screen, same sections, opposite room.
 *
 * What the light rebuild changes, beyond the palette:
 *
 * - **No photographic backdrop.** On black a photo behind the name was
 *   atmosphere; on white it is glare, and it fought every piece of text on top
 *   of it. The page is white, and the client's photographs appear where they
 *   can actually be looked at — in the collection.
 * - **The logo is a disc.** A circular mark on a white field with a thin gold
 *   ring, containing rather than cropping, so a wordmark arrives whole instead
 *   of being cut to fit an arch.
 * - **Real brand marks.** WhatsApp, Instagram, Facebook and Google appear as
 *   their own logos in their own colours, because that is what a customer
 *   recognises in the half-second after a scan. Everything that is not a brand
 *   — call, directions, enquire, the sections — stays a monochrome icon, so
 *   the colour in the grid means "this leaves for an app you know" and nothing
 *   else.
 *
 * The rules carried over from the last dark pass still hold: the collection
 * takes the leftover height, nothing animates forever, and contrast is static.
 */
const CSS = `
.qs-noor{--qs-display:"Cormorant",ui-serif,Georgia,serif;--qs-body:"Montserrat",ui-sans-serif,system-ui,sans-serif;
  --nr-line:#e7e5e4;
  --nr-line-soft:#f0efed;
  --nr-card:#ffffff;
  --nr-sunk:#faf9f7;
  /* The accent can be anything a client picks, including a pale gold that
     would vanish on white. Ink is the accent pushed towards brown until it can
     carry 12px text; the raw accent is kept for fills that sit under white. */
  --nr-ink:color-mix(in srgb,var(--t-accent) 82%,#2b1a02);
  --nr-tint:color-mix(in srgb,var(--t-accent) 10%,#ffffff);
  --nr-tint-edge:color-mix(in srgb,var(--t-accent) 22%,#ffffff)}

/* -- the room ---------------------------------------------------------- */
/* White, with one warm wash at the top so the page reads as lit rather than
   blank. No image: nothing to download, nothing to fight the type. */
.nr-art{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 54% at 50% -12%,var(--nr-tint) 0%,#fffdfa 42%,#ffffff 72%),#ffffff}
.nr-hair{position:absolute;left:50%;top:0;width:min(560px,130%);height:1px;transform:translateX(-50%);background:linear-gradient(90deg,transparent,var(--nr-tint-edge) 50%,transparent)}

/* -- vertical plan ----------------------------------------------------- */
/* Unchanged from the dark pass, because it was the part that worked: the
   collection takes the leftover height; with no pieces, the identity block
   takes it and centres. */
.qs-noor .qs-frame{padding-bottom:0}
.nr-id{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px}
.qs-noor.nr-has-case .qs-frame{--qs-logo:82px}
.qs-noor.nr-no-case .qs-frame{--qs-logo:108px}
.nr-has-case .nr-id{flex:0 0 auto;padding:clamp(6px,3cqh,20px) 0 clamp(18px,5cqh,34px)}
.nr-has-case .nr-case{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding-bottom:14px}
.nr-no-case .nr-id{flex:1 1 auto;justify-content:center;gap:14px}

/* -- chrome ------------------------------------------------------------ */
.nr-chip{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 13px;border:1px solid var(--nr-line);border-radius:999px;background:var(--nr-card);font-size:12px;color:var(--t-muted);max-width:64%;box-shadow:0 1px 2px rgb(28 25 23/.04)}
.nr-icon-btn{display:grid;place-items:center;width:44px;height:44px;border-radius:999px;border:1px solid var(--nr-line);background:var(--nr-card);color:var(--t-text);box-shadow:0 1px 2px rgb(28 25 23/.05)}

/* -- the disc ---------------------------------------------------------- */
/* A circle, not an arch: a round mark is how a jeweller's stamp and every
   shop's own logo are already drawn, and it crops nothing. */
.nr-disc{position:relative;width:var(--qs-logo);height:var(--qs-logo);border-radius:999px;background:var(--nr-card);box-shadow:0 0 0 1px var(--nr-tint-edge),0 0 0 5px #fff,0 0 0 6px var(--nr-line-soft),0 14px 30px -14px rgb(60 42 12/.30)}
.nr-disc-inner{position:absolute;inset:0;overflow:hidden;border-radius:999px;display:grid;place-items:center;font-family:var(--qs-display);font-weight:600;font-size:calc(var(--qs-logo) * .36);color:var(--nr-ink);background:var(--nr-card)}
/* Contain, never cover: a wordmark cropped to a circle is just a smear. */
.nr-disc-inner img{width:100%;height:100%;object-fit:contain;padding:13%}
.nr-disc-ring{position:absolute;inset:-1px;border-radius:999px;border:1px solid transparent;background:linear-gradient(140deg,var(--t-accent),#f2dfae 40%,var(--t-accent) 72%,#e8cf96) border-box;-webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}

/* -- name -------------------------------------------------------------- */
/* Near-black, not gold. On white, gold type is the first thing to fail for
   anyone reading in sunlight; the gold belongs on the rule beneath it. */
.nr-eyebrow{display:flex;align-items:center;justify-content:center;gap:10px;color:var(--nr-ink)}
.nr-eyebrow::before,.nr-eyebrow::after{content:"";width:26px;height:1px;background:linear-gradient(90deg,transparent,var(--t-accent))}
.nr-eyebrow::after{transform:scaleX(-1)}
.nr-eyebrow i{width:5px;height:5px;rotate:45deg;background:var(--t-accent)}
.nr-name{font-family:var(--qs-display);font-weight:600;font-size:clamp(30px,11cqw,44px);line-height:1.1;letter-spacing:.005em;text-wrap:balance;color:var(--t-text)}
.nr-tagline{font-size:14px;line-height:1.55;color:var(--t-muted);text-wrap:balance}
.nr-where{display:flex;align-items:center;justify-content:center;gap:6px;max-width:100%;font-size:13px;line-height:1.4;color:var(--t-muted)}
.nr-rating{display:inline-flex;align-items:center;gap:7px;padding:3px 11px 3px 9px;border-radius:999px;background:var(--nr-tint);box-shadow:inset 0 0 0 1px var(--nr-tint-edge);color:var(--nr-ink);font-size:13px}

/* -- the display case -------------------------------------------------- */
.nr-case-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-bottom:9px}
.nr-case-title{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--t-muted)}
.nr-case-all{display:inline-flex;align-items:center;gap:4px;padding:4px 2px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;color:var(--nr-ink)}
.nr-rail{display:flex;align-items:stretch;gap:10px;min-height:0;flex:1 1 auto;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none;padding:3px 1px;margin:0;list-style:none}
.nr-rail::-webkit-scrollbar{display:none}
.nr-piece{position:relative;flex:0 0 auto;height:100%;min-height:86px;max-height:190px;aspect-ratio:3/4;border-radius:14px;overflow:hidden;scroll-snap-align:start;background:var(--nr-sunk);box-shadow:0 0 0 1px var(--nr-line),0 8px 18px -12px rgb(28 25 23/.35)}
.nr-piece img{width:100%;height:100%;object-fit:cover}
.nr-piece-more{display:grid;place-items:center;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--nr-ink);background:var(--nr-tint)}

/* -- the act ----------------------------------------------------------- */
/* On white the foreground plane is made by a hairline and a lift, not by a
   darker panel — a grey slab under a white page reads as a different screen. */
.nr-act{flex:0 0 auto;margin-top:auto;display:flex;flex-direction:column;gap:11px;margin-inline:-18px;padding:15px 18px max(env(safe-area-inset-bottom),14px);border-radius:24px 24px 0 0;background:var(--nr-card);box-shadow:0 -1px 0 var(--nr-line),0 -18px 34px -30px rgb(28 25 23/.5)}

/* -- the pay bar ------------------------------------------------------- */
/* A flat fill looked like a disabled button at this size. The gradient only
   ever darkens from the accent, never lightens it, so white on it keeps the
   4.9:1 the accent already clears - brightening the top stop was the obvious
   move and it drops to 3.8:1. */
.nr-cta{position:relative;display:flex;align-items:center;gap:14px;width:100%;min-height:64px;padding:8px 10px 8px 20px;border-radius:16px;color:var(--t-accent-text);background:linear-gradient(170deg,var(--t-accent),color-mix(in srgb,var(--t-accent) 84%,#000));box-shadow:0 12px 26px -14px color-mix(in srgb,var(--t-accent) 70%,transparent),inset 0 1px 0 rgb(255 255 255/.22);transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease}
.nr-cta:active{transform:translateY(1px) scale(.985);box-shadow:0 6px 14px -10px color-mix(in srgb,var(--t-accent) 60%,transparent)}
.nr-cta-label{font-size:17px;line-height:1.2;font-weight:600}
.nr-cta-apps{display:flex;align-items:center;gap:7px;padding-top:3px}
/* The pay bar names the apps with their own marks instead of the words
   "GPay · PhonePe · Paytm", which is the one place a logo is genuinely faster
   to read than the label. Each is on a white chip so the brand colours keep
   their own contrast rather than sitting on gold. */
.nr-cta-app{display:grid;place-items:center;height:22px;padding:0 5px;border-radius:6px;background:#fff;box-shadow:0 1px 2px rgb(28 25 23/.18)}
.nr-cta-app svg{height:14px;width:auto}
/* Solid white, not a translucent tint: gold-on-gold made the one affordance
   on the bar the hardest thing on it to see. */
.nr-cta-icon{margin-left:auto;display:grid;place-items:center;width:46px;height:46px;border-radius:13px;background:#fff;color:var(--nr-ink);box-shadow:0 2px 6px rgb(60 42 12/.28)}

/* -- quick actions ----------------------------------------------------- */
.nr-tiles{display:grid;justify-content:center;gap:9px}
.nr-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:78px;padding:8px 5px;border-radius:15px;color:var(--t-text);font-size:12px;font-weight:500;line-height:1.2;text-align:center;text-wrap:balance;overflow-wrap:break-word;hyphens:auto;background:var(--nr-card);box-shadow:0 0 0 1px var(--nr-line),0 6px 14px -12px rgb(28 25 23/.4);transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease}
.nr-tile:active{transform:translateY(1px) scale(.97);box-shadow:0 0 0 1px var(--nr-tint-edge)}
/* A brand mark is the logo itself, at full colour, with nothing tinted behind
   it. A non-brand action gets the gold disc — so the grid reads "these three
   leave for an app, this one dials". */
.nr-tile-brand{display:grid;place-items:center;width:34px;height:34px}
.nr-tile-brand svg{width:100%;height:100%;border-radius:8px}
.nr-tile-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:999px;color:var(--nr-ink);background:var(--nr-tint);box-shadow:inset 0 0 0 1px var(--nr-tint-edge)}

/* -- sections ---------------------------------------------------------- */
.nr-dock{display:flex;align-items:stretch;justify-content:center;gap:2px;padding-top:9px;border-top:1px solid var(--nr-line)}
.nr-dock-btn{flex:1 1 0;max-width:118px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:52px;padding:0 4px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;line-height:1.2;text-align:center;color:var(--t-muted);font-family:var(--qs-body)}
.nr-dock-btn svg{color:var(--nr-ink)}
.nr-dock-btn:active{color:var(--t-text)}
.nr-brand{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#a8a29e;text-align:center}

/* -- narrow screens ---------------------------------------------------- */
@container qs (max-width:390px){.nr-tile{font-size:11px;padding-inline:3px}.nr-tiles{gap:7px}}

/* -- short screens ----------------------------------------------------- */
@container qs (max-height:700px){.nr-cta{min-height:58px}.nr-piece{max-height:150px}.nr-has-case .nr-id{padding-bottom:clamp(12px,3cqh,20px)}}
@container qs (max-height:640px){.nr-tile{min-height:66px;gap:5px}.nr-tile-icon,.nr-tile-brand{width:30px;height:30px}.nr-piece{min-height:64px;max-height:112px}.nr-case-head{padding-bottom:6px}.nr-act{gap:9px;padding-top:12px}.nr-dock-btn{min-height:46px}}
@container qs (max-height:620px){.qs-noor.nr-has-case .qs-frame{--qs-logo:62px}.nr-has-case .nr-id{gap:6px;padding-top:4px;padding-bottom:10px}.nr-has-case .nr-tagline{display:none}}
@container qs (max-height:560px){.nr-piece{min-height:56px;max-height:84px}.nr-case-head{display:none}.nr-case{padding-bottom:8px}}
`;

/** Which quick actions are a brand, and therefore get their real logo. */
const ACTION_BRAND: Partial<Record<string, BrandName>> = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  facebook: 'facebook',
  review: 'google',
};

export function NoorTheme(props: ThemeRenderProps) {
  const screen = useScreen(props);
  const { model, dock } = screen;
  const accent = props.accentColor ?? GOLD;
  const gallery: PublicGalleryImage[] = [...(props.galleryImages ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const pieces = gallery.slice(0, RAIL_LIMIT);
  const hasCase = gallery.length > 0;
  /* One chip per app, not one per configured method: a shop with two GPay
     handles would otherwise show the same logo twice. */
  const payApps = [
    ...new Set(
      [...props.paymentMethods].sort((a, b) => a.displayOrder - b.displayOrder).map((method) => method.type),
    ),
  ];

  const openGallery = () => {
    screen.open('gallery');
  };

  const rootStyle = {
    '--t-bg': '#ffffff',
    '--t-text': '#1c1917',
    '--t-muted': '#57534e',
    '--t-accent': accent,
    '--t-accent-text': readableOn(accent),
    '--t-border': '#e7e5e4',
    '--t-radius': '14px',
    '--qs-focus': '#1c1917',
    '--qs-sheet-bg': '#ffffff',
    '--qs-sheet-text': '#1c1917',
    '--qs-sheet-muted': '#57534e',
    '--qs-sheet-border': '#e7e5e4',
  } as CSSProperties;

  return (
    <div className={`qs-root qs-noor ${hasCase ? 'nr-has-case' : 'nr-no-case'}`} style={rootStyle}>
      <ThemeAssets id="noor" css={CSS} fontsHref={FONTS} />

      <div className="nr-art" aria-hidden="true">
        <span className="nr-hair" />
      </div>

      <div className="qs-frame">
        <header className="qs-rise flex shrink-0 items-center justify-between gap-3" style={{ '--i': 0 } as CSSProperties}>
          {model.hours ? (
            <span className="nr-chip">
              <Icon name="clock" className="size-3.5 shrink-0" style={{ color: 'var(--nr-ink)' }} />
              <span className="truncate">{model.hours}</span>
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" aria-label="Share this page" className="nr-icon-btn qs-press" onClick={() => void screen.share()}>
              <Icon name="share" className="size-[18px]" />
            </button>
            <button type="button" aria-label="Save contact" className="nr-icon-btn qs-press" onClick={screen.saveContact}>
              <Icon name="user-plus" className="size-[18px]" />
            </button>
          </div>
        </header>

        <section className="nr-id">
          <div className="nr-disc qs-rise" style={{ '--i': 1 } as CSSProperties}>
            <div className="nr-disc-inner">
              <Logo url={model.logoUrl} initials={model.initials} />
            </div>
            <span className="nr-disc-ring" aria-hidden="true" />
          </div>

          {model.rating ? (
            <span className="nr-rating qs-rise qs-hide-tiny" style={{ '--i': 2 } as CSSProperties}>
              <Stars rating={model.rating} size={13} />
            </span>
          ) : (
            <span className="nr-eyebrow qs-rise qs-hide-tiny" aria-hidden="true" style={{ '--i': 2 } as CSSProperties}>
              <i />
            </span>
          )}

          <h1 className="nr-name qs-clamp-2 qs-rise px-2" style={{ '--i': 2 } as CSSProperties}>
            {model.headline}
          </h1>

          {model.tagline ? (
            <p className="nr-tagline qs-tagline qs-clamp-2 qs-rise max-w-[32ch]" style={{ '--i': 3 } as CSSProperties}>
              {model.tagline}
            </p>
          ) : null}

          {model.address ? (
            <p className="nr-where qs-rise qs-hide-short" style={{ '--i': 4 } as CSSProperties}>
              <Icon name="map-pin" className="size-3.5 shrink-0" style={{ color: 'var(--nr-ink)' }} />
              <span className="truncate">{model.address}</span>
            </p>
          ) : null}
        </section>

        {hasCase ? (
          <section className="nr-case qs-rise" aria-label="Collection" style={{ '--i': 5 } as CSSProperties}>
            <div className="nr-case-head">
              <h2 className="nr-case-title">Our collection</h2>
              <button type="button" className="nr-case-all qs-press" onClick={openGallery}>
                View all {gallery.length}
                <Icon name="chevron-right" className="size-3.5" />
              </button>
            </div>
            <ul className="nr-rail">
              {pieces.map((image, index) => (
                <li key={image.id} className="nr-piece">
                  <button
                    type="button"
                    className="block h-full w-full cursor-pointer"
                    aria-label={`Piece ${String(index + 1)} of ${String(gallery.length)}, open the collection`}
                    onClick={openGallery}
                  >
                    <img src={image.imageUrl} alt="" loading="lazy" decoding="async" />
                  </button>
                </li>
              ))}
              {gallery.length > pieces.length ? (
                <li className="nr-piece nr-piece-more">
                  <button
                    type="button"
                    className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5"
                    aria-label={`Open the collection, all ${String(gallery.length)} pieces`}
                    onClick={openGallery}
                  >
                    <Icon name="image" className="size-4" />
                    All {gallery.length}
                  </button>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        <div className="nr-act">
          {model.primary ? (
            <button
              type="button"
              className="nr-cta qs-press qs-rise text-left"
              style={{ '--i': 6 } as CSSProperties}
              onClick={() => {
                screen.open('pay');
              }}
            >
              <span className="flex min-w-0 flex-col">
                <span className="nr-cta-label">{model.primary.label}</span>
                <span className="nr-cta-apps">
                  {payApps.map((type) => (
                    <span key={type} className="nr-cta-app">
                      <PlatformLogo brand={type === 'other' ? 'upi' : type} />
                    </span>
                  ))}
                </span>
              </span>
              <span className="nr-cta-icon">
                <Icon name="rupee" className="size-5" />
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="nr-cta qs-press qs-rise text-left"
              style={{ '--i': 6 } as CSSProperties}
              onClick={screen.saveContact}
            >
              <span className="nr-cta-label">Save contact</span>
              <span className="nr-cta-icon">
                <Icon name="user-plus" className="size-5" />
              </span>
            </button>
          )}

          {model.actions.length > 0 ? (
            <nav
              aria-label="Quick actions"
              className="nr-tiles"
              style={{
                gridTemplateColumns:
                  model.actions.length >= ACTION_COLUMNS
                    ? `repeat(${String(ACTION_COLUMNS)}, minmax(0, 1fr))`
                    : `repeat(${String(model.actions.length)}, minmax(0, 84px))`,
              }}
            >
              {model.actions.map((action, index) => {
                const brand = ACTION_BRAND[action.id];
                return (
                  <ScreenAction
                    key={action.id}
                    action={action}
                    screen={screen}
                    slug={props.slug}
                    businessName={props.businessName}
                    className="nr-tile qs-pop qs-press"
                    style={{ '--i': index } as CSSProperties}
                  >
                    {brand ? (
                      <span className="nr-tile-brand">
                        <PlatformLogo brand={brand} />
                      </span>
                    ) : (
                      <span className="nr-tile-icon">
                        <ActionIcon icon={actionIcon(action)} className="size-[17px]" />
                      </span>
                    )}
                    {action.label}
                  </ScreenAction>
                );
              })}
            </nav>
          ) : null}

          {dock.length > 0 ? (
            <nav aria-label="Sections" className="nr-dock qs-rise" style={{ '--i': 8 } as CSSProperties}>
              {dock.map((info) => (
                <button
                  key={info.key}
                  type="button"
                  className="nr-dock-btn qs-press"
                  onClick={() => {
                    screen.open(info.key);
                  }}
                >
                  <Icon name={info.icon} className="size-[18px]" />
                  <span className="max-w-full truncate">{info.label}</span>
                </button>
              ))}
            </nav>
          ) : null}

          {props.hideBranding ? null : <p className="nr-brand qs-hide-short">Powered by Vyapar QR</p>}
        </div>
      </div>

      <ScreenSheet screen={screen} props={props} />
    </div>
  );
}
