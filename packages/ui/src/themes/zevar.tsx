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
.qs-zevar .qs-frame{--qs-logo:92px}
.zv-hero>*{flex:0 0 auto}
.qs-zevar{--qs-display:"Cormorant",ui-serif,Georgia,serif;--qs-body:"Montserrat",ui-sans-serif,system-ui,sans-serif;--zv-line:color-mix(in srgb,var(--t-accent) 30%,transparent);--zv-glass:rgb(255 250 240/.06);
  /* One gold, described the way metal actually behaves: dark at the edges,
     a hot specular band across the middle, warm shadow beneath. Every gold
     surface on this page is cut from this same ramp, which is what stops it
     looking like flat yellow paint. */
  --zv-metal:linear-gradient(115deg,#6b4a18 0%,#a9812f 12%,#dfba6e 26%,#fff3d2 38%,#e8c77f 46%,#c9a257 56%,#8c6522 70%,#c8a154 84%,#6f4c1a 100%)}

/* ── the case ─────────────────────────────────────────────────────────── */
.zv-art{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:radial-gradient(130% 70% at 50% -8%,#3a1b20 0%,#24131a 34%,transparent 62%),radial-gradient(90% 55% at 50% 104%,#1d1411 0%,transparent 60%),var(--t-bg)}
.zv-shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;animation:zv-cross 24s ease-in-out infinite}
@keyframes zv-cross{0%{opacity:0;transform:scale(1.05)}6%{opacity:.42}28%{opacity:.42}34%{opacity:0;transform:scale(1.13)}100%{opacity:0;transform:scale(1.05)}}
.zv-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgb(16 11 10/.55) 0%,rgb(16 11 10/.74) 44%,rgb(16 11 10/.93) 80%,var(--t-bg) 100%)}
/* Velvet: a jeweller's tray, not a black rectangle. */
.zv-velvet{position:absolute;inset:0;background:radial-gradient(75% 45% at 50% 30%,rgb(140 58 60/.28),transparent 70%),radial-gradient(60% 40% at 18% 80%,rgb(90 40 44/.22),transparent 70%)}
/* Grain, inline so a QR-scanned page downloads nothing for it. */
.zv-grain{position:absolute;inset:-50%;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");animation:zv-grain 1.2s steps(3) infinite}
@keyframes zv-grain{0%{transform:translate(0,0)}33%{transform:translate(-2%,1%)}66%{transform:translate(1%,-2%)}100%{transform:translate(0,0)}}
/* The showroom light: a soft cone over the piece on display. */
.zv-spot{position:absolute;left:50%;top:-14%;width:min(120%,520px);height:62%;transform:translateX(-50%);background:conic-gradient(from 180deg at 50% 0%,transparent 148deg,color-mix(in srgb,var(--t-accent) 16%,transparent) 176deg,color-mix(in srgb,#fff1cf 22%,transparent) 180deg,color-mix(in srgb,var(--t-accent) 16%,transparent) 184deg,transparent 212deg);-webkit-mask-image:linear-gradient(#000 12%,transparent 88%);mask-image:linear-gradient(#000 12%,transparent 88%);animation:zv-beam 9s ease-in-out infinite}
@keyframes zv-beam{0%,100%{opacity:.62;transform:translateX(-50%) rotate(-1.2deg)}50%{opacity:.92;transform:translateX(-50%) rotate(1.2deg)}}
.zv-vignette{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 45%,transparent 45%,rgb(6 4 3/.55) 100%)}
.zv-sparkle{position:absolute;color:#fff6df;opacity:0;animation:zv-twinkle 6.5s ease-in-out infinite;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--t-accent) 70%,transparent))}
@keyframes zv-twinkle{0%,86%,100%{opacity:0;transform:scale(.3) rotate(0deg)}92%{opacity:1;transform:scale(1) rotate(25deg)}96%{opacity:.5;transform:scale(.8) rotate(35deg)}}

/* ── chrome ───────────────────────────────────────────────────────────── */
.zv-chip{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 13px;border:1px solid var(--zv-line);border-radius:999px;background:var(--zv-glass);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-size:12px;letter-spacing:.02em;color:var(--t-muted);max-width:64%;box-shadow:inset 0 1px 0 rgb(255 240 210/.10)}
.zv-icon-btn{display:grid;place-items:center;width:44px;height:44px;border-radius:999px;border:1px solid var(--zv-line);background:var(--zv-glass);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--t-text);box-shadow:inset 0 1px 0 rgb(255 240 210/.12)}

/* ── the piece on display: an arch, framed in metal, on a glass shelf ──── */
.zv-plinth{display:flex;flex-direction:column;align-items:center}
.zv-arch{position:relative;width:calc(var(--qs-logo) + 14px);padding:5px;border-radius:999px 999px 16px 16px;background:var(--zv-metal);box-shadow:0 22px 50px -18px rgb(0 0 0/.9),0 0 34px -6px color-mix(in srgb,var(--t-accent) 45%,transparent),inset 0 1px 0 rgb(255 248 224/.55)}
.zv-arch::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(120deg,transparent 38%,rgb(255 248 224/.55) 46%,transparent 54%);background-size:260% 100%;background-position:120% 0;animation:zv-gleam 7s ease-in-out 1.2s infinite;pointer-events:none}
@keyframes zv-gleam{0%,62%{background-position:120% 0}100%{background-position:-60% 0}}
.zv-arch-inner{position:relative;overflow:hidden;border-radius:999px 999px 12px 12px;background:radial-gradient(120% 120% at 32% 18%,#2a1d15,#0c0807);aspect-ratio:1/1.08;display:grid;place-items:center;font-family:var(--qs-display);font-weight:600;font-size:calc(var(--qs-logo) * .42);color:var(--t-accent);text-shadow:0 2px 10px rgb(0 0 0/.6)}
.zv-arch-inner img{width:100%;height:100%;object-fit:cover}
/* Reflection, as on the glass shelf of a display case. */
.zv-reflection{width:calc(var(--qs-logo) + 14px);height:26px;margin-top:2px;border-radius:0 0 999px 999px;background:linear-gradient(180deg,color-mix(in srgb,var(--t-accent) 28%,transparent),transparent 78%);-webkit-mask-image:linear-gradient(#000,transparent);mask-image:linear-gradient(#000,transparent);opacity:.5;transform:scaleY(-1)}

/* ── engraved name ────────────────────────────────────────────────────── */
.zv-eyebrow{display:flex;align-items:center;gap:10px;font-size:10px;letter-spacing:.38em;text-transform:uppercase;color:color-mix(in srgb,var(--t-accent) 92%,#fff)}
.zv-eyebrow::before,.zv-eyebrow::after{content:"";width:22px;height:1px;background:linear-gradient(90deg,transparent,var(--t-accent))}
.zv-eyebrow::after{transform:scaleX(-1)}
.zv-name{font-family:var(--qs-display);font-weight:600;font-size:clamp(30px,11cqw,44px);line-height:1.08;letter-spacing:.01em;background:var(--zv-metal);background-size:280% 100%;background-position:18% 0;-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 0 rgb(0 0 0/.55));animation:qs-rise .8s cubic-bezier(.16,1,.3,1) both,zv-foil 9s ease-in-out 1.6s infinite;animation-delay:.22s,1.6s}
@keyframes zv-foil{0%,55%{background-position:18% 0}100%{background-position:82% 0}}
.zv-tagline{font-size:14px;line-height:1.55;color:var(--t-muted)}
/* Hairline rule with a lozenge in the middle — a jeweller's mark. */
.zv-rule{display:flex;align-items:center;justify-content:center;gap:8px;width:min(230px,72%)}
.zv-rule::before,.zv-rule::after{content:"";height:1px;flex:1;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--t-accent) 60%,transparent))}
.zv-rule::after{transform:scaleX(-1)}
.zv-rule span{width:6px;height:6px;rotate:45deg;background:var(--zv-metal)}

/* ── collection rail ──────────────────────────────────────────────────── */
.zv-rail-label{display:flex;align-items:center;justify-content:space-between;font-size:9px;letter-spacing:.28em;text-transform:uppercase;color:color-mix(in srgb,var(--t-muted) 85%,transparent)}
.zv-rail{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none;padding:2px 1px}
.zv-rail::-webkit-scrollbar{display:none}
.zv-thumb{position:relative;flex:0 0 auto;width:68px;height:68px;border-radius:14px;overflow:hidden;scroll-snap-align:start;padding:2px;background:var(--zv-metal);box-shadow:0 10px 22px -14px #000}
.zv-thumb img{width:100%;height:100%;object-fit:cover;border-radius:12px}
.zv-thumb-more{display:grid;place-items:center;gap:2px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#f7e9c9;background:linear-gradient(160deg,#3a2a17,#150e09)}

/* ── the gold bar ─────────────────────────────────────────────────────── */
.zv-cta{position:relative;display:flex;align-items:center;gap:14px;width:100%;min-height:62px;padding:8px 10px 8px 22px;border-radius:16px;color:#241704;background:var(--zv-metal);background-size:180% 100%;background-position:30% 0;box-shadow:0 20px 44px -18px color-mix(in srgb,var(--t-accent) 80%,transparent),inset 0 1px 0 rgb(255 250 232/.75),inset 0 -2px 6px rgb(90 60 12/.45);transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s ease,background-position .5s ease}
.zv-cta:active{transform:translateY(1px) scale(.985);box-shadow:0 10px 24px -16px color-mix(in srgb,var(--t-accent) 70%,transparent),inset 0 2px 6px rgb(90 60 12/.5);background-position:60% 0}
.zv-cta-icon{margin-left:auto;display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:linear-gradient(160deg,#1c1207,#2e1f0d);color:var(--t-accent);box-shadow:inset 0 1px 0 rgb(255 240 200/.18)}

/* ── engraved plates ──────────────────────────────────────────────────── */
.zv-tile{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:80px;border-radius:14px;color:var(--t-text);font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;background:linear-gradient(180deg,rgb(255 244 224/.07),rgb(255 244 224/.02));box-shadow:inset 0 0 0 1px var(--zv-line),inset 0 1px 0 rgb(255 245 222/.14),0 12px 26px -20px #000;transition:transform .25s cubic-bezier(.2,.8,.2,1),background-color .25s ease}
.zv-tile:active{transform:translateY(1px) scale(.97)}
.zv-tile-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:999px;color:#2a1b06;background:var(--zv-metal);box-shadow:inset 0 1px 0 rgb(255 250 230/.6),0 6px 14px -8px color-mix(in srgb,var(--t-accent) 60%,transparent)}

/* ── dock ─────────────────────────────────────────────────────────────── */
.zv-dock{display:flex;align-items:stretch;padding-top:4px;border-top:1px solid color-mix(in srgb,var(--t-accent) 22%,transparent)}
.zv-dock-btn{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:54px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--t-muted);font-family:var(--qs-body)}
.zv-dock-btn+.zv-dock-btn::before{content:"";position:absolute;left:0;top:50%;width:4px;height:4px;rotate:45deg;translate:-2px -50%;background:color-mix(in srgb,var(--t-accent) 55%,transparent)}
.zv-dock-btn svg{color:var(--t-accent)}
.zv-dock-btn:active{color:var(--t-text)}
.zv-brand{font-size:9px;letter-spacing:.26em;text-transform:uppercase;color:color-mix(in srgb,var(--t-muted) 62%,transparent);text-align:center}

@container qs (max-height:820px){.zv-reflection{height:18px;opacity:.4}}
@container qs (max-height:700px){.zv-thumb{width:58px;height:58px}.zv-cta{min-height:56px}.zv-reflection{display:none}}
@container qs (max-height:640px){.zv-tile{min-height:66px;gap:4px}.zv-tile-icon{width:32px;height:32px}}
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
        <span className="zv-velvet" />
        <span className="zv-spot" />
        <span className="zv-grain" />
        <span className="zv-vignette" />
        <Sparkle style={{ left: '15%', top: '19%' }} />
        <Sparkle style={{ right: '17%', top: '27%', animationDelay: '2.1s' }} />
        <Sparkle style={{ left: '27%', top: '43%', animationDelay: '4.2s' }} />
        <Sparkle style={{ right: '26%', top: '52%', animationDelay: '5.6s' }} />
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

        <section className="zv-hero flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 py-2 text-center">
          <div className="zv-plinth qs-rise" style={{ '--i': 1 } as CSSProperties}>
            <div className="zv-arch">
              <div className="zv-arch-inner">
                <Logo url={model.logoUrl} initials={model.initials} />
              </div>
            </div>
            <span className="zv-reflection" aria-hidden="true" />
          </div>

          {model.rating ? (
            <Stars rating={model.rating} className="qs-rise qs-hide-tiny text-[13px] text-[var(--t-accent)]" />
          ) : (
            <span className="zv-eyebrow qs-rise qs-hide-tiny" style={{ '--i': 2 } as CSSProperties}>
              Fine jewellery
            </span>
          )}

          <h1 className="zv-name qs-clamp-2 px-2">{model.headline}</h1>

          <span className="zv-rule qs-rise qs-hide-short" aria-hidden="true" style={{ '--i': 3 } as CSSProperties}>
            <span />
          </span>

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
              <p className="zv-rail-label pb-1.5">
                <span>Our collection</span>
                <span>{gallery.length} pieces</span>
              </p>
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
