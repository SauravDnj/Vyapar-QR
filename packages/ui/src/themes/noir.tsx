'use client';

import { Icon } from '../icon';

import { readableOn } from './screen/model';
import { Logo, paymentAppsLine, Stars, ThemeAssets } from './screen/parts';
import { ActionIcon, actionIcon, ScreenAction, ScreenSheet, useScreen } from './screen/screen';

import type { ThemeRenderProps } from '@vyaparqr/types';
import type { CSSProperties } from 'react';

const GOLD = '#d6ae5c';

const FONTS =
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Playfair+Display:wght@500;600;700&display=swap';

/**
 * Noir — black and gold.
 *
 * A near-black stage with a slowly turning gold ring around the logo, a light
 * sweep across the name and a sheen on the pay button. Motion is ambient and
 * slow on purpose: luxury reads as calm, not busy.
 */
const CSS = `
.qs-noir{--qs-display:"Playfair Display",ui-serif,Georgia,serif;--qs-body:"DM Sans",ui-sans-serif,system-ui,sans-serif;--nx-line:color-mix(in srgb,var(--t-accent) 26%,transparent)}
.nx-art{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.nx-art::before{content:"";position:absolute;inset:-20% -30% auto;height:70%;background:radial-gradient(ellipse at 50% 30%,color-mix(in srgb,var(--t-accent) 26%,transparent),transparent 62%);animation:nx-breathe 7s ease-in-out infinite}
.nx-art::after{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--nx-line) 1px,transparent 1px),linear-gradient(90deg,var(--nx-line) 1px,transparent 1px);background-size:44px 44px;opacity:.16;-webkit-mask-image:radial-gradient(ellipse at 50% 20%,#000 10%,transparent 70%);mask-image:radial-gradient(ellipse at 50% 20%,#000 10%,transparent 70%)}
.nx-orb{position:absolute;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--t-accent) 30%,transparent),transparent 70%);filter:blur(18px)}
.nx-orb-a{left:-60px;bottom:18%;animation:nx-drift 16s ease-in-out infinite}
.nx-orb-b{right:-70px;bottom:44%;animation:nx-drift 19s ease-in-out -6s infinite reverse}
@keyframes nx-breathe{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
@keyframes nx-drift{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,-30px)}}
.nx-chip{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border:1px solid var(--nx-line);border-radius:999px;font-size:12px;color:var(--t-muted);background:rgb(255 255 255/.03);max-width:62%}
.nx-icon-btn{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;border:1px solid var(--nx-line);color:var(--t-text);background:rgb(255 255 255/.03)}
.nx-logo-wrap{position:relative;width:calc(var(--qs-logo) + 22px);height:calc(var(--qs-logo) + 22px);display:grid;place-items:center}
.nx-ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 12%,var(--t-accent) 30%,#fff3d6 38%,var(--t-accent) 46%,transparent 62% 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1.5px));animation:qs-spin 9s linear infinite}
.nx-ring-static{position:absolute;inset:0;border-radius:50%;border:1px solid var(--nx-line)}
.nx-logo{width:var(--qs-logo);height:var(--qs-logo);border-radius:50%;overflow:hidden;background:linear-gradient(150deg,#1d1914,#0d0b09);box-shadow:0 18px 50px -12px color-mix(in srgb,var(--t-accent) 45%,transparent),inset 0 0 0 1px var(--nx-line);font-family:var(--qs-display);font-size:calc(var(--qs-logo) * .36);color:var(--t-accent);letter-spacing:.02em}
.nx-ornament{display:flex;align-items:center;gap:10px;color:var(--t-accent)}
.nx-ornament::before,.nx-ornament::after{content:"";width:28px;height:1px;background:linear-gradient(90deg,transparent,var(--t-accent))}
.nx-ornament::after{transform:scaleX(-1)}
.nx-name{font-family:var(--qs-display);font-weight:600;font-size:clamp(28px,9cqw,38px);line-height:1.08;letter-spacing:-.01em;background:linear-gradient(100deg,var(--t-text) 0 40%,#fff5dc 48%,var(--t-accent) 52%,var(--t-text) 60% 100%);background-size:260% 100%;background-position:100% 0;-webkit-background-clip:text;background-clip:text;color:transparent;animation:qs-rise .75s cubic-bezier(.16,1,.3,1) both,nx-shimmer 7s ease-in-out 1.6s infinite;animation-delay:.21s,1.6s}
@keyframes nx-shimmer{0%,55%{background-position:100% 0}100%{background-position:-60% 0}}
.nx-tagline{color:var(--t-muted);font-size:15px;line-height:1.5}
.nx-cta{display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:8px 10px 8px 22px;border-radius:999px;color:var(--t-accent-text);background:linear-gradient(120deg,color-mix(in srgb,var(--t-accent) 82%,#fff),var(--t-accent) 45%,color-mix(in srgb,var(--t-accent) 70%,#000));box-shadow:0 16px 40px -14px color-mix(in srgb,var(--t-accent) 70%,transparent),inset 0 1px 0 rgb(255 255 255/.4)}
.nx-cta-icon{margin-left:auto;display:grid;place-items:center;width:44px;height:44px;border-radius:999px;background:color-mix(in srgb,var(--t-accent-text) 88%,transparent);color:var(--t-accent)}
.nx-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:78px;border-radius:18px;border:1px solid var(--nx-line);background:linear-gradient(180deg,rgb(255 255 255/.05),rgb(255 255 255/.015));color:var(--t-text);font-size:12px;font-weight:500;letter-spacing:.02em}
.nx-tile-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:999px;color:var(--t-accent);background:color-mix(in srgb,var(--t-accent) 12%,transparent)}
.nx-dock{display:flex;align-items:stretch;border-top:1px solid var(--nx-line)}
.nx-dock-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:54px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--t-muted)}
.nx-dock-btn svg{color:var(--t-accent)}
.nx-dock-btn:active{color:var(--t-text)}
.nx-brand{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:color-mix(in srgb,var(--t-muted) 70%,transparent);text-align:center}
@container qs (max-height:640px){.nx-tile{min-height:64px;gap:4px}.nx-tile-icon{width:32px;height:32px}.nx-cta{min-height:54px}}
`;

export function NoirTheme(props: ThemeRenderProps) {
  const screen = useScreen(props);
  const { model, dock } = screen;
  const accent = props.accentColor ?? GOLD;

  const rootStyle = {
    '--t-bg': '#0a0908',
    '--t-text': '#f6f0e6',
    '--t-muted': '#b9ad9b',
    '--t-accent': accent,
    '--t-accent-text': readableOn(accent),
    '--t-border': 'color-mix(in srgb, var(--t-accent) 26%, transparent)',
    '--t-radius': '14px',
    '--qs-sheet-bg': '#fbf8f2',
    '--qs-sheet-text': '#1c1917',
    '--qs-sheet-muted': '#57534e',
    '--qs-sheet-border': '#e7dfd0',
  } as CSSProperties;

  return (
    <div className="qs-root qs-noir" style={rootStyle}>
      <ThemeAssets id="noir" css={CSS} fontsHref={FONTS} />

      <div className="nx-art" aria-hidden="true">
        <span className="nx-orb nx-orb-a" />
        <span className="nx-orb nx-orb-b" />
      </div>

      <div className="qs-frame">
        <header className="qs-rise flex items-center justify-between gap-3" style={{ '--i': 0 } as CSSProperties}>
          {model.hours ? (
            <span className="nx-chip">
              <Icon name="clock" className="size-3.5 shrink-0" style={{ color: 'var(--t-accent)' }} />
              <span className="truncate">{model.hours}</span>
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" aria-label="Share" className="nx-icon-btn qs-press" onClick={() => void screen.share()}>
              <Icon name="share" className="size-[18px]" />
            </button>
            <button type="button" aria-label="Save contact" className="nx-icon-btn qs-press" onClick={screen.saveContact}>
              <Icon name="user-plus" className="size-[18px]" />
            </button>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-3 text-center">
          <div className="nx-logo-wrap qs-rise" style={{ '--i': 1 } as CSSProperties}>
            <span className="nx-ring-static" aria-hidden="true" />
            <span className="nx-ring" aria-hidden="true" />
            <div className="nx-logo">
              <Logo url={model.logoUrl} initials={model.initials} />
            </div>
          </div>

          {model.rating ? (
            <Stars rating={model.rating} className="qs-rise qs-hide-tiny text-[13px] text-[var(--t-accent)]" />
          ) : (
            <span className="nx-ornament qs-rise qs-hide-tiny" aria-hidden="true" style={{ '--i': 2 } as CSSProperties}>
              <Icon name="star" className="size-3" />
            </span>
          )}

          <h1 className="nx-name qs-clamp-2 px-2">{model.headline}</h1>

          {model.tagline ? (
            <p className="nx-tagline qs-tagline qs-clamp-2 qs-rise max-w-[30ch]" style={{ '--i': 3 } as CSSProperties}>
              {model.tagline}
            </p>
          ) : null}

          {model.address ? (
            <p
              className="qs-rise qs-hide-short flex max-w-full items-center gap-1.5 text-[13px] text-[var(--t-muted)]"
              style={{ '--i': 4 } as CSSProperties}
            >
              <Icon name="map-pin" className="size-3.5 shrink-0" style={{ color: 'var(--t-accent)' }} />
              <span className="truncate">{model.address}</span>
            </p>
          ) : null}
        </section>

        <div className="flex flex-col gap-3">
          <div className="qs-rise" style={{ '--i': 5 } as CSSProperties}>
            {model.primary ? (
              <button
                type="button"
                className="nx-cta qs-sheen qs-press text-left"
                onClick={() => {
                  screen.open('pay');
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[17px] leading-tight font-semibold">{model.primary.label}</span>
                  <span className="truncate text-xs opacity-75">{paymentAppsLine(props.paymentMethods)}</span>
                </span>
                <span className="nx-cta-icon">
                  <Icon name="rupee" className="size-5" />
                </span>
              </button>
            ) : (
              <button type="button" className="nx-cta qs-sheen qs-press text-left" onClick={screen.saveContact}>
                <span className="text-[17px] font-semibold">Save contact</span>
                <span className="nx-cta-icon">
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
                  className="nx-tile qs-pop qs-press"
                  style={{ '--i': index } as CSSProperties}
                >
                  <span className="nx-tile-icon">
                    <ActionIcon icon={actionIcon(action)} className="size-[18px]" />
                  </span>
                  {action.label}
                </ScreenAction>
              ))}
            </nav>
          ) : null}

          {dock.length > 0 ? (
            <nav aria-label="Sections" className="nx-dock qs-rise" style={{ '--i': 7 } as CSSProperties}>
              {dock.map((info) => (
                <button
                  key={info.key}
                  type="button"
                  className="nx-dock-btn qs-press"
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

          {props.hideBranding ? null : <p className="nx-brand qs-hide-short">Powered by Vyapar QR</p>}
        </div>
      </div>

      <ScreenSheet screen={screen} props={props} />
    </div>
  );
}
