'use client';

import { BANNER_IMAGE } from '@vyaparqr/types';

import { PlatformLogo } from '../brand-logos';
import { Icon } from '../icon';

import { directionsUrl, readableOn } from './screen/model';
import { Logo, Stars, ThemeAssets } from './screen/parts';
import { ActionIcon, actionIcon, ScreenAction, ScreenSheet, trackClick, useScreen } from './screen/screen';

import type { BrandName } from '../brand-logos';
import type { QuickAction } from './screen/model';
import type { ThemeRenderProps } from '@vyaparqr/types';
import type { CSSProperties } from 'react';

/** Gold that works on white. The dark theme needed a bright 22-carat #d9b166
 * to read against near-black; on white that same gold is barely there. This is
 * the deeper ramp of the same metal — 4.9:1 against white, so it can carry
 * text as well as decoration. */
const GOLD = '#a16207';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600&display=swap';

/**
 * The action grid's shape, from how many buttons there are.
 *
 * Every button — Call, WhatsApp, Directions, Review, each social profile,
 * Enquire — is the same tile in the same grid, so the grid is what adapts:
 * a single row up to four, then 3×2, 4×2 and 3×3, the shapes that come out
 * even. A row of one to three is drawn at the width a tile has in a row of
 * four, so a short grid is a centred row of normal tiles, not three giants.
 * `rows` drives how compact the tiles get; the screen doesn't scroll, so a
 * second and third row are paid for in tile height, not page length.
 */
export function actionGrid(count: number): { cols: number; rows: number; fillsWidth: boolean } {
  const cols = count <= 4 ? Math.max(count, 1) : count <= 6 ? 3 : count <= 8 ? 4 : 3;
  return { cols, rows: Math.ceil(count / cols), fillsWidth: count >= 4 };
}

/** Grid gap in px; the width sum below has to use the same number. */
const TILE_GAP = 8;

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
 * - **No photographs on the page itself.** On black a photo behind the name
 *   was atmosphere; on white it is glare, and it fought every piece of text
 *   above it. The inline collection rail went the same way: a shop's pieces
 *   shrunk into a strip of thumbnails told a customer nothing the Gallery
 *   sheet does not tell them properly, at size. The photographs now live in
 *   one place, behind the Gallery section.
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
const BANNER_ASPECT = `${String(BANNER_IMAGE.aspect)} / 1`;

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
   blank. */
.nr-art{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 54% at 50% -12%,var(--nr-tint) 0%,#fffdfa 42%,#ffffff 72%),#ffffff}
.nr-hair{position:absolute;left:50%;top:0;width:min(560px,130%);height:1px;transform:translateX(-50%);background:linear-gradient(90deg,transparent,var(--nr-tint-edge) 50%,transparent)}

/* -- the banner -------------------------------------------------------- */
/* The client's background image, as a cover across the top of the page with
   the logo disc on its bottom edge.

   Exactly the shape the crop step frames (BANNER_IMAGE in @vyaparqr/types),
   so what the owner sets there is what shows here. It used to take its height
   from the screen's height and its width from the screen's width — close to
   2.3:1 on a typical phone against a 3:1 crop — and then cover-cropped the
   result again, cutting the sides off an image that had already been cropped.
   The white fade over its bottom 42% is gone for the same reason: it hid part
   of the picture the owner had just positioned.

   Full-bleed from the very top edge, with the share / save buttons floating
   over it, the way a cover photo sits; the crop step shows where they land. */
.nr-banner{position:relative;flex:0 0 auto;margin:calc(-1 * max(env(safe-area-inset-top),14px)) -18px 0;aspect-ratio:${BANNER_ASPECT};overflow:hidden;background:var(--nr-sunk)}
.nr-banner img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.nr-has-banner .nr-head{position:absolute;top:max(env(safe-area-inset-top),14px);left:18px;right:18px;z-index:3}
.nr-has-banner .nr-chip,.nr-has-banner .nr-icon-btn{box-shadow:0 2px 8px rgb(28 25 23/.18)}

/* -- vertical plan ----------------------------------------------------- */
.qs-noor .qs-frame{padding-bottom:0;--qs-logo:108px}
.nr-id{display:flex;flex-direction:column;align-items:center;text-align:center;flex:1 1 auto;justify-content:center;gap:14px}
/* With a banner the disc rides up over it, the way a profile photo does. */
.nr-has-banner .nr-id{justify-content:flex-start;padding-top:0;gap:12px}
.nr-has-banner .nr-disc{margin-top:calc(var(--qs-logo) / -2 - 6px)}
.qs-noor.nr-has-banner .qs-frame{--qs-logo:92px}

/* -- chrome ------------------------------------------------------------ */
.nr-chip{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 13px;border:1px solid var(--nr-line);border-radius:999px;background:var(--nr-card);font-size:12px;color:var(--t-muted);max-width:64%;box-shadow:0 1px 2px rgb(28 25 23/.04)}
.nr-icon-btn{display:grid;place-items:center;width:44px;height:44px;border-radius:999px;border:1px solid var(--nr-line);background:var(--nr-card);color:var(--t-text);box-shadow:0 1px 2px rgb(28 25 23/.05)}

/* -- the disc ---------------------------------------------------------- */
/* A circle, not an arch: a round mark is how a jeweller's stamp and every
   shop's own logo are already drawn, and it crops nothing. */
.nr-disc{position:relative;width:var(--qs-logo);height:var(--qs-logo);border-radius:999px;background:var(--nr-card);box-shadow:0 0 0 1px var(--nr-tint-edge),0 0 0 5px #fff,0 0 0 6px var(--nr-line-soft),0 14px 30px -14px rgb(60 42 12/.30)}
.nr-disc-inner{position:absolute;inset:0;overflow:hidden;border-radius:999px;display:grid;place-items:center;font-family:var(--qs-display);font-weight:600;font-size:calc(var(--qs-logo) * .36);color:var(--nr-ink);background:var(--nr-card)}
/* Fills the circle, exactly as the crop step shows it. This used to shrink
   the logo inside the circle with 13% padding, which made sense before there
   was a crop step — an uncropped wordmark would otherwise be cut — but meant
   the logo on the page was smaller than the one the owner had positioned. */
.nr-disc-inner img{width:100%;height:100%;object-fit:cover}
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
/* The address wraps to two lines instead of ending in an ellipsis. It was a
   one-line truncate, so a real address — "161, Ram Nagar, Gate No-6, Near
   Jivan Vikas School, Udhana, Surat" — lost its area and city, the part a
   customer actually needs. The measure is capped so the two lines come out
   balanced rather than one long line and a stray word, and the pin sits
   against the first line. It opens the address in Maps. */
.nr-where{display:block;max-width:min(100%,36ch);padding:2px 4px;border-radius:8px;font-size:13px;line-height:1.45;color:var(--t-muted);text-align:center;text-decoration:none;transition:color .2s ease}
.nr-where:active{color:var(--t-text)}
.nr-where-text{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;text-wrap:balance}
/* The pin is inline, as the first glyph of the text, so it sits against the
   first word on whichever line that falls. As a separate flex item it stayed
   at the edge of the text's box while the lines centred inside it, leaving it
   floating a word's width away. */
.nr-where-pin{display:inline-block;width:13px;height:13px;margin-right:5px;vertical-align:-2px;color:var(--nr-ink)}
.nr-rating{display:inline-flex;align-items:center;gap:7px;padding:3px 11px 3px 9px;border-radius:999px;background:var(--nr-tint);box-shadow:inset 0 0 0 1px var(--nr-tint-edge);color:var(--nr-ink);font-size:13px}

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
.nr-tiles{display:grid;gap:8px;margin-inline:auto;width:100%}
.nr-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:78px;padding:8px 5px;border-radius:15px;color:var(--t-text);font-size:12px;font-weight:500;line-height:1.2;text-align:center;text-wrap:balance;overflow-wrap:break-word;hyphens:auto;background:var(--nr-card);box-shadow:0 0 0 1px var(--nr-line),0 6px 14px -12px rgb(28 25 23/.4);transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease}
.nr-tile:active{transform:translateY(1px) scale(.97);box-shadow:0 0 0 1px var(--nr-tint-edge)}
/* A brand mark is the logo itself, at full colour, with nothing tinted behind
   it. A non-brand action gets the gold disc — so the grid reads "these three
   leave for an app, this one dials". */
.nr-tile-brand{display:grid;place-items:center;width:34px;height:34px}
.nr-tile-brand svg{width:100%;height:100%;border-radius:8px}
.nr-tile-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:999px;color:var(--nr-ink);background:var(--nr-tint);box-shadow:inset 0 0 0 1px var(--nr-tint-edge)}
/* Two and three rows: every tile gets smaller together, never some of them.
   Brand logo and icon disc stay one size as each other, so a WhatsApp tile
   and a Call tile are still the same button with different faces. */
.nr-tiles-2 .nr-tile{min-height:66px;gap:5px;padding:7px 4px;font-size:11.5px}
.nr-tiles-2 .nr-tile-brand,.nr-tiles-2 .nr-tile-icon{width:30px;height:30px}
.nr-tiles-3{gap:7px}
.nr-tiles-3 .nr-tile{min-height:56px;gap:4px;padding:6px 3px;font-size:11px;border-radius:13px}
.nr-tiles-3 .nr-tile-brand,.nr-tiles-3 .nr-tile-icon{width:26px;height:26px}
.nr-tiles-3 .nr-tile-brand svg{border-radius:7px}
/* More rows means less room above: the logo gives way before the buttons do. */
.qs-noor.nr-dense-2 .qs-frame{--qs-logo:88px}
.qs-noor.nr-dense-3 .qs-frame{--qs-logo:72px}
.nr-dense-3 .nr-id{gap:9px}

/* -- sections ---------------------------------------------------------- */
.nr-dock{display:flex;align-items:stretch;justify-content:center;gap:2px;padding-top:9px;border-top:1px solid var(--nr-line)}
.nr-dock-btn{flex:1 1 0;max-width:118px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:52px;padding:0 4px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;line-height:1.2;text-align:center;color:var(--t-muted);font-family:var(--qs-body)}
.nr-dock-btn svg{color:var(--nr-ink)}
.nr-dock-btn:active{color:var(--t-text)}
.nr-brand{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#a8a29e;text-align:center}

/* -- narrow screens ---------------------------------------------------- */
@container qs (max-width:390px){.nr-tile{font-size:11px;padding-inline:3px}.nr-tiles{gap:7px}.nr-tiles-3 .nr-tile{font-size:10.5px}}
@container qs (max-height:720px){.nr-dense-3 .nr-where-text{-webkit-line-clamp:1}.nr-tiles-2 .nr-tile{min-height:60px}.nr-tiles-3 .nr-tile{min-height:50px}.qs-noor.nr-dense-3 .qs-frame{--qs-logo:60px}}

/* -- short screens ----------------------------------------------------- */
@container qs (max-height:700px){.nr-cta{min-height:58px}}
@container qs (max-height:640px){.nr-tile{min-height:66px;gap:5px}.nr-tile-icon,.nr-tile-brand{width:30px;height:30px}.nr-act{gap:9px;padding-top:12px}.nr-dock-btn{min-height:46px}}
@container qs (max-height:620px){.qs-noor .qs-frame{--qs-logo:76px}.nr-id{gap:8px}}
`;

/** Tiles that open another company's app get that company's logo. */
const BRAND_ICONS = new Set<string>(['whatsapp', 'instagram', 'facebook', 'linkedin', 'x', 'youtube']);

function brandFor(action: QuickAction): BrandName | undefined {
  if (action.kind === 'review') return 'google';
  if (action.kind === 'link' && BRAND_ICONS.has(action.icon)) return action.icon as BrandName;
  return undefined;
}

export function NoorTheme(props: ThemeRenderProps) {
  const screen = useScreen(props);
  const { model, dock } = screen;
  const accent = props.accentColor ?? GOLD;
  const bannerUrl = props.content.hero?.backgroundImageUrl ?? '';
  const grid = actionGrid(model.actions.length);
  /* One chip per app, not one per configured method: a shop with two GPay
     handles would otherwise show the same logo twice. */
  const payApps = [
    ...new Set(
      [...props.paymentMethods].sort((a, b) => a.displayOrder - b.displayOrder).map((method) => method.type),
    ),
  ];

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
    <div
      className={`qs-root qs-noor ${bannerUrl ? 'nr-has-banner' : ''} ${grid.rows > 1 ? `nr-dense-${String(Math.min(grid.rows, 3))}` : ''}`}
      style={rootStyle}
    >
      <ThemeAssets id="noor" css={CSS} fontsHref={FONTS} />

      <div className="nr-art" aria-hidden="true">
        <span className="nr-hair" />
      </div>

      <div className="qs-frame">
        <header className="nr-head qs-rise flex shrink-0 items-center justify-between gap-3" style={{ '--i': 0 } as CSSProperties}>
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

        {bannerUrl ? (
          <div className="nr-banner qs-rise" style={{ '--i': 0 } as CSSProperties}>
            <img src={bannerUrl} alt="" loading="eager" decoding="async" />
          </div>
        ) : null}

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
            <a
              href={directionsUrl(model.address)}
              target="_blank"
              rel="noopener noreferrer"
              title={model.address}
              className="nr-where qs-rise qs-hide-short"
              style={{ '--i': 4 } as CSSProperties}
              onClick={() => {
                trackClick(props.slug, 'address');
              }}
            >
              <span className="nr-where-text">
                <Icon name="map-pin" className="nr-where-pin" />
                {model.address}
              </span>
            </a>
          ) : null}
        </section>

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
              className={`nr-tiles ${grid.rows > 1 ? `nr-tiles-${String(Math.min(grid.rows, 3))}` : ''}`}
              style={{
                gridTemplateColumns: `repeat(${String(grid.cols)}, minmax(0, 1fr))`,
                // A short row keeps the width a tile has in a row of four.
                maxWidth: grid.fillsWidth
                  ? undefined
                  : `calc(${String(grid.cols)} * (100% - ${String(3 * TILE_GAP)}px) / 4 + ${String((grid.cols - 1) * TILE_GAP)}px)`,
              }}
            >
              {model.actions.map((action, index) => {
                const brand = brandFor(action);
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
