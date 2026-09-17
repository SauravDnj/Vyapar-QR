'use client';

import { Icon } from '../icon';

import { readableOn } from './screen/model';
import { Logo, paymentAppsLine, Stars, ThemeAssets } from './screen/parts';
import { ActionIcon, actionIcon, ScreenAction, ScreenSheet, useScreen } from './screen/screen';

import type { ThemeRenderProps } from '@vyaparqr/types';
import type { CSSProperties } from 'react';

const EMERALD = '#123c2f';
const FOIL = '#c9a45c';

const FONTS =
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Serif+Display&display=swap';

/**
 * Ivory — a premium printed business card.
 *
 * The top of the screen is the card itself: the brand colour, a fine
 * guilloche pattern like security printing, and a gold foil edge that catches
 * the light. It flips up into place on load, then the actions settle in
 * beneath it on warm paper.
 */
const CSS = `
.qs-ivory{--qs-display:"DM Serif Display",ui-serif,Georgia,serif;--qs-body:"DM Sans",ui-sans-serif,system-ui,sans-serif;--iv-foil:${FOIL}}
.iv-art{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 60% at 50% 100%,#ebe3d5,transparent 70%),var(--t-bg)}
.iv-stage{perspective:1400px}
.iv-card{position:relative;border-radius:30px;overflow:hidden;color:var(--iv-card-text);background:linear-gradient(160deg,color-mix(in srgb,var(--t-accent) 88%,#fff) 0%,var(--t-accent) 38%,color-mix(in srgb,var(--t-accent) 78%,#000) 100%);box-shadow:0 30px 60px -28px color-mix(in srgb,var(--t-accent) 80%,#000),0 2px 0 rgb(255 255 255/.25) inset;transform-origin:50% 0%;animation:iv-flip 1.1s cubic-bezier(.16,1,.3,1) both}
@keyframes iv-flip{from{opacity:0;transform:rotateX(-58deg) translateY(-18px) scale(.96)}to{opacity:1;transform:none}}
.iv-card::before{content:"";position:absolute;inset:10px;border-radius:22px;border:1px solid color-mix(in srgb,var(--iv-foil) 60%,transparent);pointer-events:none}
.iv-card::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 42%,rgb(255 240 205/.20) 50%,transparent 58%);animation:iv-foil 6.5s ease-in-out 1.4s infinite;pointer-events:none}
@keyframes iv-foil{0%,50%{transform:translateX(-45%)}100%{transform:translateX(45%)}}
.iv-guilloche{position:absolute;right:-90px;bottom:-110px;width:320px;height:320px;opacity:.22;color:var(--iv-foil);animation:qs-spin 80s linear infinite}
.iv-logo{width:var(--qs-logo);height:var(--qs-logo);border-radius:50%;overflow:hidden;background:color-mix(in srgb,var(--iv-card-text) 12%,transparent);box-shadow:0 0 0 2px color-mix(in srgb,var(--iv-foil) 85%,transparent),0 0 0 7px color-mix(in srgb,var(--iv-card-text) 8%,transparent);font-family:var(--qs-display);font-size:calc(var(--qs-logo) * .38);color:var(--iv-card-text)}
.iv-icon-btn{display:grid;place-items:center;width:44px;height:44px;border-radius:999px;color:var(--iv-card-text);background:color-mix(in srgb,var(--iv-card-text) 12%,transparent);border:1px solid color-mix(in srgb,var(--iv-card-text) 18%,transparent)}
.iv-name{font-family:var(--qs-display);font-weight:400;font-size:clamp(30px,10cqw,42px);line-height:1.04;letter-spacing:-.01em;text-wrap:balance}
.iv-rule{height:2px;width:56px;border-radius:2px;background:linear-gradient(90deg,var(--iv-foil),color-mix(in srgb,var(--iv-foil) 30%,transparent));transform-origin:left;animation:iv-draw .9s cubic-bezier(.16,1,.3,1) .7s both}
@keyframes iv-draw{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.iv-card-muted{color:color-mix(in srgb,var(--iv-card-text) 80%,transparent)}
.iv-hours{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;font-size:12px;background:color-mix(in srgb,var(--iv-card-text) 12%,transparent);max-width:100%}
.iv-action{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--t-text)}
.iv-action-icon{display:grid;place-items:center;width:56px;height:56px;border-radius:999px;background:#fff;color:var(--qs-ink);box-shadow:0 10px 24px -14px rgb(60 40 10/.45),0 0 0 1px #ebe3d5}
.iv-cta{display:flex;align-items:center;gap:12px;width:100%;min-height:58px;padding:8px 8px 8px 22px;border-radius:18px;color:var(--t-accent-text);background:var(--t-accent);box-shadow:0 16px 34px -18px color-mix(in srgb,var(--t-accent) 90%,#000)}
.iv-cta-icon{margin-left:auto;display:grid;place-items:center;width:42px;height:42px;border-radius:13px;color:var(--t-accent);background:var(--iv-foil)}
.iv-dock{display:flex;padding:5px;border-radius:20px;background:#fff;box-shadow:0 1px 0 #ebe3d5,0 12px 30px -20px rgb(60 40 10/.4)}
.iv-dock-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:50px;border-radius:15px;font-size:11px;font-weight:500;color:var(--t-muted)}
.iv-dock-btn svg{color:var(--qs-ink)}
.iv-dock-btn:active{background:#f4efe6}
.iv-brand{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#78716c;text-align:center}
@container qs (max-height:700px){.iv-action-icon{width:50px;height:50px}.iv-cta{min-height:52px}}
@container qs (max-height:600px){.iv-action-icon{width:44px;height:44px}.iv-action{font-size:11px;gap:4px}}
`;

/** Concentric rotated ellipses — the fine-line pattern of printed security paper. */
function Guilloche() {
  return (
    <svg className="iv-guilloche" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.6" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => (
        <ellipse key={index} cx="100" cy="100" rx="92" ry="38" transform={`rotate(${String(index * 10)} 100 100)`} />
      ))}
      <circle cx="100" cy="100" r="30" />
      <circle cx="100" cy="100" r="52" />
    </svg>
  );
}

export function IvoryTheme(props: ThemeRenderProps) {
  const screen = useScreen(props);
  const { model, dock } = screen;
  const accent = props.accentColor ?? EMERALD;

  const rootStyle = {
    '--t-bg': '#f4efe6',
    '--t-text': '#1c1917',
    '--t-muted': '#57534e',
    '--t-accent': accent,
    '--t-accent-text': readableOn(accent),
    '--t-border': '#e2d9c8',
    '--t-radius': '14px',
    '--iv-card-text': readableOn(accent),
    '--qs-sheet-bg': '#fffdf9',
    '--qs-sheet-text': '#1c1917',
    '--qs-sheet-muted': '#57534e',
    '--qs-sheet-border': '#e8e1d4',
  } as CSSProperties;

  return (
    <div className="qs-root qs-ivory" style={rootStyle}>
      <ThemeAssets id="ivory" css={CSS} fontsHref={FONTS} />
      <div className="iv-art" aria-hidden="true" />

      <div className="qs-frame gap-4">
        <div className="iv-stage flex min-h-0 flex-1 flex-col">
          <section className="iv-card flex min-h-0 flex-1 flex-col p-6">
            <Guilloche />

            <div className="relative flex items-start justify-between gap-3">
              <div className="iv-logo shrink-0">
                <Logo url={model.logoUrl} initials={model.initials} />
              </div>
              <div className="flex gap-2">
                <button type="button" aria-label="Share" className="iv-icon-btn qs-press" onClick={() => void screen.share()}>
                  <Icon name="share" className="size-[18px]" />
                </button>
                <button type="button" aria-label="Save contact" className="iv-icon-btn qs-press" onClick={screen.saveContact}>
                  <Icon name="user-plus" className="size-[18px]" />
                </button>
              </div>
            </div>

            <div className="relative mt-auto flex min-h-0 flex-col gap-2.5 pt-4">
              <span className="iv-rule" aria-hidden="true" />
              <h1 className="iv-name qs-clamp-2 qs-rise" style={{ '--i': 3 } as CSSProperties}>
                {model.headline}
              </h1>
              {model.tagline ? (
                <p className="iv-card-muted qs-tagline qs-clamp-2 qs-rise text-[15px] leading-normal" style={{ '--i': 4 } as CSSProperties}>
                  {model.tagline}
                </p>
              ) : null}
              <div className="qs-rise qs-hide-tiny flex flex-wrap items-center gap-2 pt-1" style={{ '--i': 5 } as CSSProperties}>
                {model.rating ? (
                  <span className="iv-hours">
                    <Stars rating={model.rating} size={13} className="text-[var(--iv-card-text)] [&_svg]:text-[#e8c77e]" />
                  </span>
                ) : null}
                {model.address ? (
                  <span className="iv-hours qs-hide-short">
                    <Icon name="map-pin" className="size-3.5 shrink-0" />
                    <span className="truncate">{model.address}</span>
                  </span>
                ) : null}
                {model.hours ? (
                  <span className="iv-hours qs-hide-short">
                    <Icon name="clock" className="size-3.5 shrink-0" />
                    <span className="truncate">{model.hours}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        {model.actions.length > 0 ? (
          <nav
            aria-label="Quick actions"
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${String(model.actions.length)}, minmax(0, 1fr))` }}
          >
            {model.actions.map((action, index) => (
              <ScreenAction
                key={action.id}
                action={action}
                screen={screen}
                slug={props.slug}
                businessName={props.businessName}
                className="iv-action qs-pop qs-press"
                style={{ '--i': index + 3 } as CSSProperties}
              >
                <span className="iv-action-icon">
                  <ActionIcon icon={actionIcon(action)} className="size-[22px]" />
                </span>
                {action.label}
              </ScreenAction>
            ))}
          </nav>
        ) : null}

        <div className="flex flex-col gap-2.5">
          <div className="qs-rise" style={{ '--i': 7 } as CSSProperties}>
            {model.primary ? (
              <button
                type="button"
                className="iv-cta qs-press text-left"
                onClick={() => {
                  screen.open('pay');
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[17px] leading-tight font-semibold">{model.primary.label}</span>
                  <span className="truncate text-xs opacity-80">{paymentAppsLine(props.paymentMethods)}</span>
                </span>
                <span className="iv-cta-icon">
                  <Icon name="rupee" className="size-5" />
                </span>
              </button>
            ) : (
              <button type="button" className="iv-cta qs-press text-left" onClick={screen.saveContact}>
                <span className="text-[17px] font-semibold">Save contact</span>
                <span className="iv-cta-icon">
                  <Icon name="user-plus" className="size-5" />
                </span>
              </button>
            )}
          </div>

          {dock.length > 0 ? (
            <nav aria-label="Sections" className="iv-dock qs-rise" style={{ '--i': 8 } as CSSProperties}>
              {dock.map((info) => (
                <button
                  key={info.key}
                  type="button"
                  className="iv-dock-btn qs-press"
                  onClick={() => {
                    screen.open(info.key);
                  }}
                >
                  <Icon name={info.icon} className="size-5" />
                  <span className="max-w-full truncate px-1">{info.label}</span>
                </button>
              ))}
            </nav>
          ) : null}

          {props.hideBranding ? null : <p className="iv-brand qs-hide-short">Powered by Vyapar QR</p>}
        </div>
      </div>

      <ScreenSheet screen={screen} props={props} />
    </div>
  );
}
