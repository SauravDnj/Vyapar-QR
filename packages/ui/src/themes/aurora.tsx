'use client';

import { Icon } from '../icon';

import { readableOn } from './screen/model';
import { Logo, paymentAppsLine, Stars, ThemeAssets } from './screen/parts';
import { ActionIcon, actionIcon, ScreenAction, ScreenSheet, useScreen } from './screen/screen';

import type { ThemeRenderProps } from '@vyaparqr/types';
import type { CSSProperties } from 'react';

const VIOLET = '#6d4aff';

const FONTS = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

/**
 * Aurora — moving colour behind frosted glass.
 *
 * Three blurred colour fields drift on long, offset loops behind a layer of
 * glass tiles. Text never sits on raw colour: a dark scrim under the lower
 * half keeps white copy at a readable contrast whatever the blobs are doing.
 */
const CSS = `
.qs-aurora{--qs-display:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif;--qs-body:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif;--au-glass:rgb(255 255 255/.10);--au-glass-line:rgb(255 255 255/.20)}
.au-art{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:var(--t-bg)}
.au-blob{position:absolute;border-radius:50%;filter:blur(56px);opacity:.9;will-change:transform}
.au-blob-a{width:78%;aspect-ratio:1;left:-22%;top:-12%;background:var(--t-accent);animation:au-a 17s ease-in-out infinite}
.au-blob-b{width:70%;aspect-ratio:1;right:-26%;top:14%;background:#ff4f9a;animation:au-b 21s ease-in-out infinite}
.au-blob-c{width:74%;aspect-ratio:1;left:4%;top:40%;background:#17b8e0;opacity:.7;animation:au-c 24s ease-in-out infinite}
@keyframes au-a{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(26%,12%) scale(1.15)}66%{transform:translate(8%,26%) scale(.92)}}
@keyframes au-b{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-30%,20%) scale(1.2)}70%{transform:translate(-12%,-8%) scale(.9)}}
@keyframes au-c{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(18%,-22%) scale(1.12)}}
.au-art::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgb(12 10 29/.15) 0%,rgb(12 10 29/.35) 38%,rgb(12 10 29/.82) 72%,rgb(12 10 29/.94) 100%)}
.au-glass{background:var(--au-glass);border:1px solid var(--au-glass-line);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);box-shadow:inset 0 1px 0 rgb(255 255 255/.18)}
.au-icon-btn{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;color:#fff}
.au-chip{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:500;color:#fff;max-width:62%}
.au-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 0 rgb(74 222 128/.6);animation:au-dot 2.2s ease-out infinite}
@keyframes au-dot{0%{box-shadow:0 0 0 0 rgb(74 222 128/.6)}100%{box-shadow:0 0 0 9px rgb(74 222 128/0)}}
.au-logo{width:var(--qs-logo);height:var(--qs-logo);border-radius:30%;overflow:hidden;font-weight:800;font-size:calc(var(--qs-logo) * .34);color:#fff;animation:qs-float 6s ease-in-out infinite}
.au-logo-shell{padding:5px;border-radius:32%}
.au-name{font-weight:800;font-size:clamp(30px,10cqw,42px);line-height:1.02;letter-spacing:-.035em;color:#fff;text-wrap:balance}
.au-tagline{font-size:15px;line-height:1.5;color:rgb(255 255 255/.82)}
.au-cta{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:8px 8px 8px 20px;border-radius:20px;background:#fff;color:#14112e;box-shadow:0 18px 44px -16px rgb(0 0 0/.6)}
.au-cta-icon{margin-left:auto;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;color:var(--t-accent-text);background:linear-gradient(135deg,var(--t-accent),#ff4f9a);--qs-pulse:var(--t-accent);animation:qs-pulse 2.4s ease-out infinite}
.au-tile{position:relative;display:flex;flex-direction:column;justify-content:space-between;min-height:74px;padding:12px 14px;border-radius:20px;color:#fff;text-align:left;font-size:14px;font-weight:600;overflow:hidden}
.au-tile::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 0% 0%,rgb(255 255 255/.14),transparent 60%);pointer-events:none}
.au-tile-arrow{position:absolute;right:12px;top:12px;color:rgb(255 255 255/.7)}
.au-tile-wide{grid-column:1 / -1}
.au-dock{display:flex;padding:5px;border-radius:22px}
.au-dock-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:52px;border-radius:17px;font-size:11px;font-weight:600;color:rgb(255 255 255/.86)}
.au-dock-btn:active{background:rgb(255 255 255/.14)}
.au-brand{font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:rgb(255 255 255/.55);text-align:center}
@container qs (max-height:700px){.au-tile{min-height:60px;padding:9px 12px}.au-cta{min-height:54px}}
@container qs (max-height:600px){.au-tile{min-height:50px;flex-direction:row;align-items:center;gap:8px}.au-tile-arrow{display:none}}
`;

export function AuroraTheme(props: ThemeRenderProps) {
  const screen = useScreen(props);
  const { model, dock } = screen;
  const accent = props.accentColor ?? VIOLET;
  const actionCount = model.actions.length;

  const rootStyle = {
    '--t-bg': '#0c0a1d',
    '--t-text': '#ffffff',
    '--t-muted': '#d9d6ea',
    '--t-accent': accent,
    '--t-accent-text': readableOn(accent),
    '--t-border': 'rgb(255 255 255 / 0.2)',
    '--t-radius': '16px',
    '--qs-focus': '#ffffff',
    '--qs-sheet-bg': '#ffffff',
    '--qs-sheet-text': '#14112e',
    '--qs-sheet-muted': '#5b5870',
    '--qs-sheet-border': '#e6e3f0',
  } as CSSProperties;

  return (
    <div className="qs-root qs-aurora" style={rootStyle}>
      <ThemeAssets id="aurora" css={CSS} fontsHref={FONTS} />

      <div className="au-art" aria-hidden="true">
        <span className="au-blob au-blob-a" />
        <span className="au-blob au-blob-b" />
        <span className="au-blob au-blob-c" />
      </div>

      <div className="qs-frame">
        <header className="qs-rise flex items-center justify-between gap-3" style={{ '--i': 0 } as CSSProperties}>
          {model.hours ? (
            <span className="au-chip au-glass">
              <span className="au-dot shrink-0" aria-hidden="true" />
              <span className="truncate">{model.hours}</span>
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" aria-label="Share" className="au-icon-btn au-glass qs-press" onClick={() => void screen.share()}>
              <Icon name="share" className="size-[18px]" />
            </button>
            <button type="button" aria-label="Save contact" className="au-icon-btn au-glass qs-press" onClick={screen.saveContact}>
              <Icon name="user-plus" className="size-[18px]" />
            </button>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col justify-end gap-3 pt-3 pb-5">
          <div className="au-logo-shell au-glass qs-rise w-fit" style={{ '--i': 1 } as CSSProperties}>
            <div className="au-logo" style={{ background: `linear-gradient(135deg, ${accent}, #ff4f9a)` }}>
              <Logo url={model.logoUrl} initials={model.initials} />
            </div>
          </div>

          <h1 className="au-name qs-clamp-2 qs-rise" style={{ '--i': 2 } as CSSProperties}>
            {model.headline}
          </h1>

          {model.tagline ? (
            <p className="au-tagline qs-tagline qs-clamp-2 qs-rise max-w-[34ch]" style={{ '--i': 3 } as CSSProperties}>
              {model.tagline}
            </p>
          ) : null}

          <div className="qs-rise qs-hide-tiny flex flex-wrap items-center gap-2" style={{ '--i': 4 } as CSSProperties}>
            {model.rating ? (
              <span className="au-chip au-glass">
                <Stars rating={model.rating} size={13} className="text-[#fde68a]" />
              </span>
            ) : null}
            {model.address ? (
              <span className="au-chip au-glass qs-hide-short">
                <Icon name="map-pin" className="size-3.5 shrink-0" />
                <span className="truncate">{model.address}</span>
              </span>
            ) : null}
          </div>
        </section>

        <div className="flex flex-col gap-2.5">
          <div className="qs-rise" style={{ '--i': 5 } as CSSProperties}>
            {model.primary ? (
              <button
                type="button"
                className="au-cta qs-press text-left"
                onClick={() => {
                  screen.open('pay');
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[17px] leading-tight font-bold">{model.primary.label}</span>
                  <span className="truncate text-xs font-medium text-[#5b5870]">{paymentAppsLine(props.paymentMethods)}</span>
                </span>
                <span className="au-cta-icon">
                  <Icon name="rupee" className="size-5" />
                </span>
              </button>
            ) : (
              <button type="button" className="au-cta qs-press text-left" onClick={screen.saveContact}>
                <span className="text-[17px] font-bold">Save contact</span>
                <span className="au-cta-icon">
                  <Icon name="user-plus" className="size-5" />
                </span>
              </button>
            )}
          </div>

          {actionCount > 0 ? (
            <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2.5">
              {model.actions.map((action, index) => (
                <ScreenAction
                  key={action.id}
                  action={action}
                  screen={screen}
                  slug={props.slug}
                  businessName={props.businessName}
                  className={`au-tile au-glass qs-pop qs-press ${
                    actionCount % 2 === 1 && index === actionCount - 1 ? 'au-tile-wide' : ''
                  }`}
                  style={{ '--i': index } as CSSProperties}
                >
                  <ActionIcon icon={actionIcon(action)} className="size-[22px]" />
                  <Icon name="arrow-up-right" className="au-tile-arrow size-4" />
                  <span>{action.label}</span>
                </ScreenAction>
              ))}
            </nav>
          ) : null}

          {dock.length > 0 ? (
            <nav aria-label="Sections" className="au-dock au-glass qs-rise" style={{ '--i': 8 } as CSSProperties}>
              {dock.map((info) => (
                <button
                  key={info.key}
                  type="button"
                  className="au-dock-btn qs-press"
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

          {props.hideBranding ? null : <p className="au-brand qs-hide-short">Powered by Vyapar QR</p>}
        </div>
      </div>

      <ScreenSheet screen={screen} props={props} />
    </div>
  );
}
