'use client';

import { buildAppsScript } from '@vyaparqr/types';
import { useState } from 'react';

import { syncReviewsNow } from '../lib/reviews-api';
import {
  ApiError,
  backfillWebhook,
  connectWebhook,
  deleteWebhook,
  prepareSheetsWebhook,
  testWebhook,
  type Webhook,
} from '../lib/webhooks-api';

/**
 * Walks a business owner through connecting a Google Sheet.
 *
 * The order of the steps is the point of this component. The script needs the
 * secret baked in before it is deployed, and the web app URL only exists after
 * it is deployed — so the connection is created first (secret, no URL), the
 * script is shown with that secret already in it, and the URL is the last
 * thing asked for. Done any other way, the owner deploys twice.
 */
export function GoogleSheetsConnect({
  accessToken,
  connection,
  onChange,
}: {
  accessToken: string;
  connection: Webhook | null;
  onChange: () => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<null | 'start' | 'connect' | 'test' | 'sync' | 'reviews' | 'remove'>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showScript, setShowScript] = useState(false);

  const pending = connection !== null && !connection.url;
  const script = connection ? buildAppsScript(connection.secret) : '';

  async function run<T>(kind: NonNullable<typeof busy>, action: () => Promise<T>, done?: (value: T) => void) {
    setBusy(kind);
    setNotice(null);
    try {
      const value = await action();
      done?.(value);
      await onChange();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof ApiError ? error.message : 'Something went wrong. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setShowScript(true);
    }
  }

  return (
    <section className="flex max-w-2xl flex-col gap-4 rounded-lg border border-border-color p-5">
      <div>
        <h2 className="text-lg font-semibold">Connect Google Sheets</h2>
        <p className="mt-1 text-sm text-muted">
          Keep a Google Sheet up to date with your leads, payments and customer feedback — automatically, as they
          happen — and show the reviews you keep in its <b>Reviews</b> tab on your page. It takes about five minutes
          and needs only your Google account.
        </p>
      </div>

      {notice ? (
        <p className={`text-sm ${notice.tone === 'ok' ? 'text-success' : 'text-danger'}`} role="status">
          {notice.text}
        </p>
      ) : null}

      {connection === null ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run('start', () => prepareSheetsWebhook(accessToken))}
          className="w-fit cursor-pointer rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground disabled:opacity-50"
        >
          {busy === 'start' ? 'Starting…' : 'Start'}
        </button>
      ) : null}

      {pending ? (
        <ol className="flex flex-col gap-4 text-sm">
          <Step n={1} title="Create a sheet">
            Open{' '}
            <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              sheets.new
            </a>{' '}
            and give it a name. Leave it empty — the tabs are created for you.
          </Step>

          <Step n={2} title="Paste the script">
            In the sheet, choose <b>Extensions → Apps Script</b>. Delete what is in <code>Code.gs</code>, paste this
            script, and click <b>Save</b>. Your secret is already filled in.
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void copyScript()}
                className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs text-accent-foreground"
              >
                {copied ? 'Copied ✓' : 'Copy script'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowScript((v) => !v);
                }}
                className="cursor-pointer rounded-md border border-border-color px-3 py-1.5 text-xs"
              >
                {showScript ? 'Hide script' : 'Show script'}
              </button>
            </div>
            {showScript ? <ScriptBlock script={script} /> : null}
          </Step>

          <Step n={3} title="Deploy it">
            Choose <b>Deploy → New deployment</b>, click the gear and pick <b>Web app</b>. Set <b>Execute as: Me</b>{' '}
            and <b>Who has access: Anyone</b>, then <b>Deploy</b>.
            <p className="mt-1 text-xs text-muted">
              Google will warn that it hasn&apos;t verified the app — expected for a script you add yourself. Choose{' '}
              <b>Advanced → Go to your project → Allow</b>. “Anyone” is what lets our server reach the script; the
              secret is what stops anyone else writing to your sheet.
            </p>
          </Step>

          <Step n={4} title="Paste the web app URL">
            Copy the <b>Web app URL</b> Google shows you — it ends in <code>/exec</code>.
            <form
              className="mt-2 flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = url.trim();
                if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(trimmed)) {
                  setNotice({ tone: 'error', text: 'That doesn’t look like an Apps Script web app URL. It should start with https://script.google.com/' });
                  return;
                }
                if (trimmed.endsWith('/dev')) {
                  setNotice({ tone: 'error', text: 'That is the test (/dev) URL. Use the deployment URL ending in /exec.' });
                  return;
                }
                void run(
                  'connect',
                  async () => {
                    await connectWebhook(accessToken, connection.id, trimmed);
                    return testWebhook(accessToken, connection.id);
                  },
                  (result) => {
                    setUrl('');
                    setNotice(
                      result.ok
                        ? { tone: 'ok', text: 'Connected. A “Vyapar QR” tab should now be in your sheet — next, sync your existing data.' }
                        : { tone: 'error', text: `Saved, but the test didn’t go through: ${result.error ?? 'unknown error'}` },
                    );
                  },
                );
              }}
            >
              <input
                type="url"
                required
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                }}
                placeholder="https://script.google.com/macros/s/…/exec"
                className="flex-1 rounded-md border border-border-color px-3 py-2"
              />
              <button
                type="submit"
                disabled={busy !== null}
                className="cursor-pointer rounded-md bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50"
              >
                {busy === 'connect' ? 'Connecting…' : 'Connect'}
              </button>
            </form>
          </Step>
        </ol>
      ) : null}

      {connection && !pending ? (
        <div className="flex flex-col gap-3 text-sm">
          <Status connection={connection} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void run(
                  'test',
                  () => testWebhook(accessToken, connection.id),
                  (result) => {
                    setNotice(
                      result.ok
                        ? { tone: 'ok', text: 'Test delivered — check the “Vyapar QR” tab in your sheet.' }
                        : { tone: 'error', text: `Test failed: ${result.error ?? 'unknown error'}` },
                    );
                  },
                )
              }
              className="cursor-pointer rounded-md border border-border-color px-3 py-1.5 disabled:opacity-50"
            >
              {busy === 'test' ? 'Sending…' : 'Send test'}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void run(
                  'sync',
                  () => backfillWebhook(accessToken, connection.id),
                  (result) => {
                    setNotice(
                      result.failed === 0
                        ? { tone: 'ok', text: `Sent ${String(result.leads)} leads and ${String(result.payments)} payments to your sheet.` }
                        : { tone: 'error', text: `${String(result.failed)} batch(es) didn’t go through. See the error above and try again.` },
                    );
                  },
                )
              }
              className="cursor-pointer rounded-md border border-border-color px-3 py-1.5 disabled:opacity-50"
            >
              {busy === 'sync' ? 'Syncing…' : 'Sync existing data'}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void run(
                  'reviews',
                  () => syncReviewsNow(accessToken),
                  (config) => {
                    setNotice({
                      tone: 'ok',
                      text: config.avgRatingCached
                        ? `Reviews loaded from your sheet — average ${config.avgRatingCached} stars.`
                        : 'Your sheet has no reviews yet. Put them in the Reviews tab, then try again.',
                    });
                  },
                )
              }
              className="cursor-pointer rounded-md border border-border-color px-3 py-1.5 disabled:opacity-50"
            >
              {busy === 'reviews' ? 'Loading…' : 'Get reviews from sheet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowScript((v) => !v);
              }}
              className="cursor-pointer rounded-md border border-border-color px-3 py-1.5"
            >
              {showScript ? 'Hide script' : 'Show script'}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('remove', () => deleteWebhook(accessToken, connection.id))}
              className="cursor-pointer rounded-md px-3 py-1.5 text-danger disabled:opacity-50"
            >
              {busy === 'remove' ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>

          {showScript ? (
            <>
              <p className="text-xs text-muted">
                Editing the script? Saving isn’t enough: choose <b>Deploy → Manage deployments → Edit → Version: New
                version → Deploy</b>. The URL stays the same.
              </p>
              <ScriptBlock script={script} />
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <div className="mt-0.5 text-muted">{children}</div>
      </div>
    </li>
  );
}

function ScriptBlock({ script }: { script: string }) {
  return (
    <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-gray-950 p-3 text-[11px] leading-relaxed text-gray-100">
      {script}
    </pre>
  );
}

/** The last delivery, in words. The whole feature is silent by design — it
 * must never break a customer's action — so this line is the only way an
 * owner finds out their sheet stopped updating. */
function Status({ connection }: { connection: Webhook }) {
  if (!connection.lastDeliveredAt) {
    return <p className="text-muted">Connected. Nothing has been sent yet.</p>;
  }
  const when = formatWhen(connection.lastDeliveredAt);
  /* suppressHydrationWarning on the time only: a timestamp is the one thing
     the server (UTC, its own locale) and the browser (the owner's zone) are
     allowed to disagree about, and bare toLocaleString() rendered it
     "21/9/2026" on one and "9/21/2026" on the other. */
  return connection.lastError ? (
    <p className="text-danger">
      Last delivery failed (<time suppressHydrationWarning>{when}</time>): {connection.lastError}
    </p>
  ) : (
    <p className="text-success">
      Connected ✓ — last delivered <time suppressHydrationWarning>{when}</time>.
    </p>
  );
}

/** An explicit locale, so the format is the same everywhere; this product's
 * owners are in India. */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
