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

/** Photos behind the identity block, cross-faded. Three is enough to feel
 * alive without making a QR-scanned page download a gallery before it
 * renders, and the cycle is written to tile exactly 1-3 of them. */
const BACKDROP_COUNT = 3;

/** Pieces on the rail before the "All" tile takes over. */
const RAIL_LIMIT = 8;

/** Above this many quick actions the grid stretches to fill the width; below
 * it, fixed-width tiles are centred instead. One action stretched across the
 * whole screen reads as a layout bug, not as emphasis. */
const ACTION_COLUMNS = 4;

/**
 * Zevar - a jewellery showroom on one screen.
 *
 * Luxury-retail direction: Cormorant over Montserrat, near-black with a gold
 * accent, glass surfaces. The theme's own decisions are the jewellery ones -
 * the client's own pieces cross-fade behind the identity block, the name is
 * struck in foil, and the collection is a lit display case rather than a strip
 * of thumbnails, because in this trade the product *is* the marketing.
 *
 * Three rules this pass is built on, each of which the previous passes broke:
 *
 * 1. **The screen is divided by what people came for.** The identity block is
 *    sized by its content; the *collection* takes the leftover height, so a
 *    tall phone shows bigger jewellery instead of a bigger void. With no
 *    photos to show, the identity block takes the slack and centres in it - a
 *    composed empty page rather than an accidental one. Before this, the hero
 *    held `flex-1` and a page with only a name and a UPI id left ~180px of
 *    nothing above the pay button.
 * 2. **Nothing animates forever.** A page that never settles reads as a slot
 *    machine, and a full-screen grain layer repainting three times a second is
 *    a battery tax on a page opened from a paper QR code. The entrance plays
 *    once; after that only the photographs change. Grain, spotlight and foil
 *    are painted once and left alone.
 * 3. **Contrast is never animated and never below AA.** The name used to sit
 *    in a gradient that slid from bright gold to brown underneath it, so half
 *    a word could be unreadable depending on the second you looked. Text gold
 *    is now a static ramp whose darkest stop still clears 10:1 on this
 *    background.
 */
const CSS = `
.qs-zevar{--qs-display:"Cormorant",ui-serif,Georgia,serif;--qs-body:"Montserrat",ui-sans-serif,system-ui,sans-serif;
  --zv-line:color-mix(in srgb,var(--t-accent) 30%,transparent);
  --zv-glass:rgb(255 250 240/.06);
  --zv-ink:#2a1a06;
  --zv-ink-soft:#4a3410;
  /* One gold, described the way metal actually behaves: dark at the edges, a
     hot specular band across the middle, warm shadow beneath. Every metal
     *surface* is cut from this ramp, which is what stops it looking like flat
     yellow paint. */
  --zv-metal:linear-gradient(115deg,#6b4a18 0%,#a9812f 12%,#dfba6e 26%,#fff3d2 38%,#e8c77f 46%,#c9a257 56%,#8c6522 70%,#c8a154 84%,#6f4c1a 100%);
  /* The same metal with the dark stops removed, for gold *text*. Its darkest
     stop (#dcb56d) still reads ~10:1 on --t-bg, so no letter of a business
     name can fall out of contrast. Static: never animated. */
  --zv-metal-text:linear-gradient(100deg,#e3c383 0%,#fff4d6 26%,#dcb56d 52%,#f7e6bb 78%,#e0bd79 100%);
  /* The pay bar, pinned so the hot band sits under the label and the ramp only
     darkens towards the icon on the right. Its darkest stop under text still
     reads ~7:1 against --zv-ink. */
  --zv-metal-cta:linear-gradient(100deg,#f6e2b0 0%,#e9cd8c 44%,#d6ae62 74%,#bb9246 100%)}

/* -- the case ---------------------------------------------------------- */
.zv-art{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:radial-gradient(130% 70% at 50% -8%,#3a1b20 0%,#24131a 34%,transparent 62%),radial-gradient(90% 55% at 50% 104%,#1d1411 0%,transparent 60%),var(--t-bg)}
/* The first photograph is painted even with animation off, so a
   reduced-motion visitor gets the showroom rather than a black box. */
.zv-shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-fill-mode:both}
.zv-shot:first-of-type{opacity:.26}
.zv-art[data-shots="2"] .zv-shot{animation-name:zv-cross-2;animation-duration:16s}
.zv-art[data-shots="3"] .zv-shot{animation-name:zv-cross-3;animation-duration:24s}
/* Each photograph holds for ~7s and hands over in ~1s, and the windows tile
   the whole cycle. The previous pass left a third of every cycle with no photo
   at all, which read as the image having failed to load. */
@keyframes zv-cross-2{0%{opacity:.26}42%{opacity:.26}50%{opacity:0}92%{opacity:0}100%{opacity:.26}}
@keyframes zv-cross-3{0%{opacity:.26}28%{opacity:.26}33%{opacity:0}95%{opacity:0}100%{opacity:.26}}
/* Measured against the worst case rather than a pretty one: these are photos
   the client uploads, so the backdrop can be a white studio shot or a poster
   with type on it. At the old .38/.52 the lettering of a bright photo read
   straight through the business name. The composite now keeps the darkest stop
   of the name's gold above 7:1 wherever the photograph happens to be white. */
.zv-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgb(16 11 10/.62) 0%,rgb(16 11 10/.80) 40%,rgb(16 11 10/.93) 74%,var(--t-bg) 100%)}
/* Velvet: a jeweller's tray, not a black rectangle. */
.zv-velvet{position:absolute;inset:0;background:radial-gradient(75% 45% at 50% 28%,rgb(140 58 60/.26),transparent 70%),radial-gradient(60% 40% at 18% 78%,rgb(90 40 44/.20),transparent 70%)}
/* Grain, inline so a QR-scanned page downloads nothing for it. Painted once:
   it used to re-render the whole viewport every 400ms, forever, for a texture
   nobody can consciously see. */
.zv-grain{position:absolute;inset:0;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")}
/* The showroom light: a soft cone over the piece on display, held still. */
.zv-spot{position:absolute;left:50%;top:-14%;width:min(120%,520px);height:58%;transform:translateX(-50%);opacity:.75;background:conic-gradient(from 180deg at 50% 0%,transparent 148deg,color-mix(in srgb,var(--t-accent) 16%,transparent) 176deg,color-mix(in srgb,#fff1cf 22%,transparent) 180deg,color-mix(in srgb,var(--t-accent) 16%,transparent) 184deg,transparent 212deg);-webkit-mask-image:linear-gradient(#000 12%,transparent 88%);mask-image:linear-gradient(#000 12%,transparent 88%)}
.zv-vignette{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 45%,transparent 45%,rgb(6 4 3/.55) 100%)}
/* Three glints, on the entrance only. They used to twinkle forever. */
.zv-sparkle{position:absolute;color:#fff6df;opacity:0;animation:zv-twinkle 6s ease-in-out 3;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--t-accent) 70%,transparent))}
@keyframes zv-twinkle{0%,86%,100%{opacity:0;transform:scale(.3) rotate(0deg)}92%{opacity:1;transform:scale(1) rotate(25deg)}96%{opacity:.5;transform:scale(.8) rotate(35deg)}}

/* -- vertical plan ----------------------------------------------------- */
/* Who gets the leftover height: with pieces to show, the display case does;
   without, the identity block does and centres in it. */
.qs-zevar .qs-frame{padding-bottom:0}
.zv-id{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px}
.qs-zevar.zv-has-case .qs-frame{--qs-logo:76px}
.qs-zevar.zv-no-case .qs-frame{--qs-logo:104px}
.zv-has-case .zv-id{flex:0 0 auto;padding:clamp(6px,3cqh,20px) 0 clamp(18px,5cqh,34px)}
/* overflow:hidden is load-bearing, not tidiness: the rail's pieces have a
   minimum height, so on a short screen the case would otherwise paint straight
   through the act panel below it. */
.zv-has-case .zv-case{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding-bottom:14px}
.zv-no-case .zv-id{flex:1 1 auto;justify-content:center;gap:14px}

/* -- chrome ------------------------------------------------------------ */
.zv-chip{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 13px;border:1px solid var(--zv-line);border-radius:999px;background:var(--zv-glass);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-size:12px;letter-spacing:.01em;color:var(--t-muted);max-width:64%;box-shadow:inset 0 1px 0 rgb(255 240 210/.10)}
.zv-icon-btn{display:grid;place-items:center;width:44px;height:44px;border-radius:999px;border:1px solid var(--zv-line);background:var(--zv-glass);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--t-text);box-shadow:inset 0 1px 0 rgb(255 240 210/.12)}

/* -- the piece on display: an arch, framed in metal, lit from above ----- */
.zv-plinth{display:flex;flex-direction:column;align-items:center}
.zv-arch{position:relative;width:calc(var(--qs-logo) + 14px);padding:5px;border-radius:999px 999px 16px 16px;background:var(--zv-metal);box-shadow:0 22px 50px -18px rgb(0 0 0/.9),0 0 34px -6px color-mix(in srgb,var(--t-accent) 45%,transparent),inset 0 1px 0 rgb(255 248 224/.55)}
.zv-arch-inner{position:relative;overflow:hidden;border-radius:999px 999px 12px 12px;background:radial-gradient(120% 120% at 32% 18%,#2a1d15,#0c0807);aspect-ratio:1/1.08;display:grid;place-items:center;font-family:var(--qs-display);font-weight:600;font-size:calc(var(--qs-logo) * .42);color:var(--t-accent);text-shadow:0 2px 10px rgb(0 0 0/.6)}
/* A brand mark is not a photograph: the shared Logo part crops with
   object-fit:cover, which cut the edges off a wordmark and let a logo's own
   white backing fill the whole arch. Contain, inset, so the mark arrives
   whole and the arch keeps a dark border around it. */
.zv-arch-inner img{width:100%;height:100%;object-fit:contain;padding:11%}
/* The shelf the arch stands on: a lit line, not the grey smear that a flipped
   gradient made of it. */
.zv-shelf{position:relative;width:calc(var(--qs-logo) + 54px);height:14px;margin-top:6px}
.zv-shelf::before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--t-accent) 70%,transparent) 50%,transparent)}
.zv-shelf::after{content:"";position:absolute;inset:0;background:radial-gradient(60% 100% at 50% 0%,color-mix(in srgb,var(--t-accent) 26%,transparent),transparent 72%)}

/* -- engraved name ----------------------------------------------------- */
.zv-eyebrow{display:flex;align-items:center;justify-content:center;gap:10px;color:color-mix(in srgb,var(--t-accent) 92%,#fff)}
.zv-eyebrow::before,.zv-eyebrow::after{content:"";width:26px;height:1px;background:linear-gradient(90deg,transparent,var(--t-accent))}
.zv-eyebrow::after{transform:scaleX(-1)}
.zv-eyebrow i{width:5px;height:5px;rotate:45deg;background:var(--zv-metal)}
.zv-name{font-family:var(--qs-display);font-weight:600;font-size:clamp(30px,11cqw,44px);line-height:1.1;letter-spacing:.01em;text-wrap:balance;background:var(--zv-metal-text);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 0 rgb(0 0 0/.55))}
.zv-tagline{font-size:14px;line-height:1.55;color:var(--t-muted);text-wrap:balance}
.zv-where{display:flex;align-items:center;justify-content:center;gap:6px;max-width:100%;font-size:13px;line-height:1.4;color:var(--t-muted)}

/* -- the display case -------------------------------------------------- */
.zv-case-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-bottom:9px}
.zv-case-title{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--t-muted)}
.zv-case-all{display:inline-flex;align-items:center;gap:4px;padding:4px 2px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;color:var(--t-accent)}
.zv-rail{display:flex;align-items:stretch;gap:10px;min-height:0;flex:1 1 auto;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none;padding:2px 1px;margin:0;list-style:none}
.zv-rail::-webkit-scrollbar{display:none}
/* Height-driven, so leftover space becomes bigger jewellery rather than bigger
   emptiness. */
.zv-piece{position:relative;flex:0 0 auto;height:100%;min-height:86px;max-height:190px;aspect-ratio:3/4;border-radius:15px;overflow:hidden;scroll-snap-align:start;padding:2px;background:var(--zv-metal);box-shadow:0 14px 28px -16px #000}
.zv-piece img{width:100%;height:100%;object-fit:cover;border-radius:13px}
.zv-piece-more{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#f7e9c9;background:linear-gradient(160deg,#3a2a17,#150e09)}

/* -- the act: everything the page is actually for ---------------------- */
/* A foreground plane. Without it the pay bar, the actions and the sections all
   float on the same gradient at the same depth.
   The auto top margin is the safety net: whatever else is on the screen, and
   whichever blocks a container query has hidden, leftover height collects
   above this panel and the panel stays on the bottom edge. */
.zv-act{flex:0 0 auto;margin-top:auto;display:flex;flex-direction:column;gap:11px;margin-inline:-18px;padding:15px 18px max(env(safe-area-inset-bottom),14px);border-radius:24px 24px 0 0;background:linear-gradient(180deg,rgb(28 19 15/.72),rgb(13 9 8/.95));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--t-accent) 22%,transparent),0 -20px 44px -28px #000}

/* -- the gold bar ------------------------------------------------------ */
.zv-cta{position:relative;display:flex;align-items:center;gap:14px;width:100%;min-height:64px;padding:8px 10px 8px 20px;border-radius:16px;color:var(--zv-ink);background:var(--zv-metal-cta);box-shadow:0 18px 40px -20px color-mix(in srgb,var(--t-accent) 80%,transparent),inset 0 1px 0 rgb(255 250 232/.75),inset 0 -2px 6px rgb(90 60 12/.45);transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s ease}
.zv-cta:active{transform:translateY(1px) scale(.985);box-shadow:0 10px 24px -16px color-mix(in srgb,var(--t-accent) 70%,transparent),inset 0 2px 6px rgb(90 60 12/.5)}
.zv-cta-label{font-size:17px;line-height:1.2;font-weight:600}
.zv-cta-sub{font-size:12px;line-height:1.3;color:var(--zv-ink-soft)}
.zv-cta-icon{margin-left:auto;display:grid;place-items:center;width:46px;height:46px;border-radius:13px;background:linear-gradient(160deg,#1c1207,#2e1f0d);color:var(--t-accent);box-shadow:inset 0 1px 0 rgb(255 240 200/.18)}

/* -- engraved plates --------------------------------------------------- */
.zv-tiles{display:grid;justify-content:center;gap:9px}
/* Sentence case at 12px, allowed to wrap to two lines. Uppercase at 11px with
   .08em tracking made "Directions" and "Instagram" wider than their tile. */
/* overflow-wrap:anywhere was a trap here: it makes the tile's min-content
   width one character wide, so the grid track collapsed and "WhatsApp" wrapped
   to "WhatsAp / p". break-word leaves intrinsic sizing alone and only breaks a
   word that genuinely cannot fit. */
.zv-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:78px;padding:8px 5px;border-radius:15px;color:var(--t-text);font-size:12px;font-weight:500;line-height:1.2;letter-spacing:.01em;text-align:center;text-wrap:balance;overflow-wrap:break-word;hyphens:auto;background:linear-gradient(180deg,rgb(255 244 224/.08),rgb(255 244 224/.025));box-shadow:inset 0 0 0 1px var(--zv-line),inset 0 1px 0 rgb(255 245 222/.14),0 12px 26px -20px #000;transition:transform .25s cubic-bezier(.2,.8,.2,1),background-color .25s ease}
.zv-tile:active{transform:translateY(1px) scale(.97)}
.zv-tile-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:999px;color:var(--zv-ink);background:var(--zv-metal);box-shadow:inset 0 1px 0 rgb(255 250 230/.6),0 6px 14px -8px color-mix(in srgb,var(--t-accent) 60%,transparent)}

/* -- sections ---------------------------------------------------------- */
.zv-dock{display:flex;align-items:stretch;justify-content:center;gap:2px;padding-top:9px;border-top:1px solid color-mix(in srgb,var(--t-accent) 20%,transparent)}
.zv-dock-btn{flex:1 1 0;max-width:118px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:52px;padding:0 4px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;line-height:1.2;text-align:center;color:var(--t-muted);font-family:var(--qs-body)}
.zv-dock-btn svg{color:var(--t-accent)}
.zv-dock-btn:active{color:var(--t-text)}
.zv-brand{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--t-dim);text-align:center}

/* -- narrow screens ---------------------------------------------------- */
/* At 360px the four tiles are ~74px wide and a 12px "Directions" no longer
   fits on one line. */
@container qs (max-width:390px){.zv-tile{font-size:11px;padding-inline:3px;letter-spacing:0}.zv-tiles{gap:7px}}

/* -- short screens ----------------------------------------------------- */
/* The case compresses rather than disappearing, so the bottom of the page
   keeps its proportions on a small phone instead of opening a gap. The
   identity block gives up the room, in this order: the shelf, the tagline,
   then the logo's size - the collection is the product, and the pay bar and
   the actions are what the page is for. */
@container qs (max-height:700px){.zv-cta{min-height:58px}.zv-piece{max-height:150px}.zv-has-case .zv-id{padding-bottom:clamp(12px,3cqh,20px)}}
@container qs (max-height:640px){.zv-tile{min-height:66px;gap:5px}.zv-tile-icon{width:32px;height:32px}.zv-shelf{display:none}.zv-piece{min-height:64px;max-height:112px}.zv-case-head{padding-bottom:6px}.zv-act{gap:9px;padding-top:12px}.zv-dock-btn{min-height:46px}}
@container qs (max-height:620px){.qs-zevar.zv-has-case .qs-frame{--qs-logo:58px}.zv-has-case .zv-id{gap:6px;padding-top:4px;padding-bottom:10px}.zv-has-case .zv-tagline{display:none}}
@container qs (max-height:560px){.zv-piece{min-height:56px;max-height:84px}.zv-case-head{display:none}.zv-case{padding-bottom:8px}}
`;

/** A four-point sparkle - the glint a cut stone throws. */
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
  const pieces = gallery.slice(0, RAIL_LIMIT);
  const hasCase = gallery.length > 0;

  const openGallery = () => {
    screen.open('gallery');
  };

  const rootStyle = {
    '--t-bg': '#0f0b0a',
    '--t-text': '#f7efe2',
    '--t-muted': '#cbbcab',
    '--t-dim': '#a89681',
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
    <div className={`qs-root qs-zevar ${hasCase ? 'zv-has-case' : 'zv-no-case'}`} style={rootStyle}>
      <ThemeAssets id="zevar" css={CSS} fontsHref={FONTS} />

      <div className="zv-art" data-shots={backdrops.length} aria-hidden="true">
        {backdrops.map((image, index) => (
          <img
            key={image.id}
            src={image.imageUrl}
            alt=""
            className="zv-shot"
            /* The one image on screen at first paint is the one the page should
               not wait for an observer to request. */
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'low'}
            decoding="async"
            style={{ animationDelay: `${String(index * 8)}s` }}
          />
        ))}
        <span className="zv-scrim" />
        <span className="zv-velvet" />
        <span className="zv-spot" />
        <span className="zv-grain" />
        <span className="zv-vignette" />
        {/* Kept in the top corners, clear of the identity block: at 26%/44%
            they used to land on the tagline and on the collection heading. */}
        <Sparkle style={{ left: '7%', top: '12%' }} />
        <Sparkle style={{ right: '8%', top: '18%', animationDelay: '2.1s' }} />
        <Sparkle style={{ left: '11%', top: '24%', animationDelay: '4.2s' }} />
      </div>

      <div className="qs-frame">
        <header className="qs-rise flex shrink-0 items-center justify-between gap-3" style={{ '--i': 0 } as CSSProperties}>
          {model.hours ? (
            <span className="zv-chip">
              <Icon name="clock" className="size-3.5 shrink-0" style={{ color: 'var(--t-accent)' }} />
              <span className="truncate">{model.hours}</span>
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" aria-label="Share this page" className="zv-icon-btn qs-press" onClick={() => void screen.share()}>
              <Icon name="share" className="size-[18px]" />
            </button>
            <button type="button" aria-label="Save contact" className="zv-icon-btn qs-press" onClick={screen.saveContact}>
              <Icon name="user-plus" className="size-[18px]" />
            </button>
          </div>
        </header>

        <section className="zv-id">
          <div className="zv-plinth qs-rise" style={{ '--i': 1 } as CSSProperties}>
            <div className="zv-arch">
              <div className="zv-arch-inner">
                <Logo url={model.logoUrl} initials={model.initials} />
              </div>
            </div>
            <span className="zv-shelf" aria-hidden="true" />
          </div>

          {model.rating ? (
            <Stars rating={model.rating} className="qs-rise qs-hide-tiny text-sm text-[var(--t-accent)]" />
          ) : (
            /* No rating yet: a jeweller's mark, not a claim. The theme used to
               print "Fine jewellery" here, which is the theme's idea of the
               business rather than the business's own. */
            <span className="zv-eyebrow qs-rise qs-hide-tiny" aria-hidden="true" style={{ '--i': 2 } as CSSProperties}>
              <i />
            </span>
          )}

          <h1 className="zv-name qs-clamp-2 qs-rise px-2" style={{ '--i': 2 } as CSSProperties}>
            {model.headline}
          </h1>

          {model.tagline ? (
            <p className="zv-tagline qs-tagline qs-clamp-2 qs-rise max-w-[32ch]" style={{ '--i': 3 } as CSSProperties}>
              {model.tagline}
            </p>
          ) : null}

          {model.address ? (
            <p className="zv-where qs-rise qs-hide-short" style={{ '--i': 4 } as CSSProperties}>
              <Icon name="map-pin" className="size-3.5 shrink-0" style={{ color: 'var(--t-accent)' }} />
              <span className="truncate">{model.address}</span>
            </p>
          ) : null}
        </section>

        {/* Deliberately not `qs-hide-short`: the case is the element that
            absorbs the leftover height, so hiding it on a short screen would
            put the void back. It compresses instead — see the container
            queries at the end of CSS. */}
        {hasCase ? (
          <section className="zv-case qs-rise" aria-label="Collection" style={{ '--i': 5 } as CSSProperties}>
            <div className="zv-case-head">
              <h2 className="zv-case-title">Our collection</h2>
              <button type="button" className="zv-case-all qs-press" onClick={openGallery}>
                View all {gallery.length}
                <Icon name="chevron-right" className="size-3.5" />
              </button>
            </div>
            <ul className="zv-rail">
              {pieces.map((image, index) => (
                <li key={image.id} className="zv-piece">
                  <button
                    type="button"
                    className="block h-full w-full cursor-pointer"
                    /* Eight buttons all labelled "Open the collection" gave a
                       screen reader eight identical stops. */
                    aria-label={`Piece ${String(index + 1)} of ${String(gallery.length)}, open the collection`}
                    onClick={openGallery}
                  >
                    <img src={image.imageUrl} alt="" loading="lazy" decoding="async" />
                  </button>
                </li>
              ))}
              {gallery.length > pieces.length ? (
                <li className="zv-piece zv-piece-more">
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

        <div className="zv-act">
          {model.primary ? (
            <button
              type="button"
              className="zv-cta qs-press qs-rise text-left"
              style={{ '--i': 6 } as CSSProperties}
              onClick={() => {
                screen.open('pay');
              }}
            >
              <span className="flex min-w-0 flex-col">
                <span className="zv-cta-label">{model.primary.label}</span>
                <span className="zv-cta-sub truncate">{paymentAppsLine(props.paymentMethods)}</span>
              </span>
              <span className="zv-cta-icon">
                <Icon name="rupee" className="size-5" />
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="zv-cta qs-press qs-rise text-left"
              style={{ '--i': 6 } as CSSProperties}
              onClick={screen.saveContact}
            >
              <span className="zv-cta-label">Save contact</span>
              <span className="zv-cta-icon">
                <Icon name="user-plus" className="size-5" />
              </span>
            </button>
          )}

          {model.actions.length > 0 ? (
            <nav
              aria-label="Quick actions"
              className="zv-tiles"
              style={{
                gridTemplateColumns:
                  model.actions.length >= ACTION_COLUMNS
                    ? `repeat(${String(ACTION_COLUMNS)}, minmax(0, 1fr))`
                    : `repeat(${String(model.actions.length)}, minmax(0, 84px))`,
              }}
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
                  <span className="max-w-full truncate">{info.label}</span>
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
