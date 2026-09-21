import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { buildAppsScript, PLACEHOLDER_SECRET } from '@vyaparqr/types';

import { WebhooksService } from './webhooks.service';

import type { PrismaService } from '../prisma/prisma.service';
import type { AddressInfo } from 'node:net';

/**
 * The Google Sheets connector is two programs that have to agree: this API
 * signs and sends, and a script running inside Google verifies and writes.
 * Nothing in a typecheck connects them, so these tests run the *real*
 * generated script — not a copy of its logic — inside a small stand-in for
 * the Apps Script runtime, and drive it both directly and through the real
 * WebhooksService over HTTP.
 */

type Cell = unknown;

interface FakeRange {
  getValues: () => Cell[][];
  setValues: (values: Cell[][]) => FakeRange;
  setFontWeight: () => FakeRange;
  setNumberFormat: (format: string) => FakeRange;
}

interface TextOutput {
  content: string;
  setMimeType: () => TextOutput;
}

/** Just enough of SpreadsheetApp for the connector: a sheet is a grid of rows. */
class FakeSheet {
  rows: Cell[][] = [];
  formats: Record<number, string> = {};
  frozen = 0;
  constructor(public name: string) {}
  getLastRow() {
    return this.rows.length;
  }
  getMaxRows() {
    return 1000;
  }
  setFrozenRows(n: number) {
    this.frozen = n;
  }
  appendRow(row: Cell[]) {
    this.rows.push(row);
  }
  getRange(row: number, col: number, numRows = 1, numCols = 1): FakeRange {
    // Arrow functions, so `this` stays the sheet inside the range's methods.
    const range: FakeRange = {
      getValues: () =>
        Array.from({ length: numRows }, (_, r) =>
          Array.from({ length: numCols }, (_, c) => this.rows[row - 1 + r]?.[col - 1 + c] ?? ''),
        ),
      setValues: (values) => {
        values.forEach((line, r) => {
          const target = (this.rows[row - 1 + r] ??= []);
          line.forEach((value, c) => {
            target[col - 1 + c] = value;
          });
        });
        return range;
      },
      setFontWeight: () => range,
      setNumberFormat: (format) => {
        this.formats[col] = format;
        return range;
      },
    };
    return range;
  }
}

function makeRuntime() {
  const sheets = new Map<string, FakeSheet>();
  const book = {
    getSheetByName: (name: string) => sheets.get(name) ?? null,
    insertSheet: (name: string) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    },
  };
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => book },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (content: string): TextOutput => {
        const output: TextOutput = { content, setMimeType: () => output };
        return output;
      },
    },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      // Apps Script hands back Java bytes: signed, -128..127.
      computeHmacSha256Signature: (value: string, key: string, charset?: string) =>
        [...createHmac('sha256', key).update(value, charset === 'utf8' ? 'utf8' : 'latin1').digest()].map((b) =>
          b > 127 ? b - 256 : b,
        ),
    },
  } as Record<string, unknown>;
  return { context, sheets };
}

function loadScript(secret: string) {
  const runtime = makeRuntime();
  runInNewContext(buildAppsScript(secret), runtime.context);
  const doPost = runtime.context.doPost as (e: unknown) => { content: string };
  const post = (body: string, signature: string) =>
    JSON.parse(doPost({ postData: { contents: body }, parameter: { vqr_signature: signature } }).content) as Record<string, unknown>;
  return { ...runtime, post };
}

const sign = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('hex');

const lead = (over: Record<string, unknown> = {}) => ({
  id: 'lead-1',
  name: 'Asha',
  phone: '919820011223',
  source: 'contact_form',
  status: 'new',
  notes: '',
  tags: '',
  createdAt: '2026-09-21T10:00:00.000Z',
  ...over,
});

describe('Google Sheets connector script', () => {
  const secret = 's3cret';

  it('refuses a request that was not signed with its secret', () => {
    const { post, sheets } = loadScript(secret);
    const body = JSON.stringify({ event: 'lead.created', data: lead() });
    expect(post(body, sign(body, 'someone-else'))).toMatchObject({ ok: false });
    expect(post(body, '')).toMatchObject({ ok: false });
    expect(sheets.size).toBe(0);
  });

  it('writes a lead to a Leads tab it creates, with a header row', () => {
    const { post, sheets } = loadScript(secret);
    const body = JSON.stringify({ event: 'lead.created', data: lead() });
    expect(post(body, sign(body, secret))).toMatchObject({ ok: true, written: 1 });

    const tab = sheets.get('Leads');
    expect(tab?.rows[0]?.[0]).toBe('ID');
    expect(tab?.rows[1]?.slice(0, 5)).toEqual(['lead-1', 'Asha', '919820011223', 'contact_form', 'new']);
    expect(tab?.frozen).toBe(1);
  });

  it('updates the same row when a lead changes, instead of adding another', () => {
    const { post, sheets } = loadScript(secret);
    for (const [event, data] of [
      ['lead.created', lead()],
      ['lead.updated', lead({ status: 'won', notes: 'Bought the bangles' })],
      ['lead.updated', lead({ status: 'won', notes: 'Bought the bangles' })], // a repeated delivery
    ] as const) {
      const body = JSON.stringify({ event, data });
      post(body, sign(body, secret));
    }
    const tab = sheets.get('Leads');
    expect(tab?.rows).toHaveLength(2); // header + one lead
    expect(tab?.rows[1]?.[4]).toBe('won');
    expect(tab?.rows[1]?.[5]).toBe('Bought the bangles');
  });

  it('verifies a signature over a Hindi name, which only works signed as UTF-8', () => {
    const { post, sheets } = loadScript(secret);
    const body = JSON.stringify({ event: 'lead.created', data: lead({ name: 'आशा शर्मा' }) });
    expect(post(body, sign(body, secret))).toMatchObject({ ok: true });
    expect(sheets.get('Leads')?.rows[1]?.[1]).toBe('आशा शर्मा');
  });

  it('keeps phone numbers as text so Sheets cannot turn them into 9.19E+11', () => {
    const { post, sheets } = loadScript(secret);
    const body = JSON.stringify({ event: 'lead.created', data: lead() });
    post(body, sign(body, secret));
    // Column 3 is `phone`.
    expect(sheets.get('Leads')?.formats[3]).toBe('@');
  });

  it('turns timestamps into real dates so the column sorts by date', () => {
    const { post, sheets } = loadScript(secret);
    const body = JSON.stringify({ event: 'lead.created', data: lead() });
    post(body, sign(body, secret));
    const created = sheets.get('Leads')?.rows[1]?.[7];
    // The script runs in its own realm, so check the shape rather than `instanceof`.
    expect(Object.prototype.toString.call(created)).toBe('[object Date]');
  });

  it('writes a backfill batch, keeping the newer copy of a repeated id', () => {
    const { post, sheets } = loadScript(secret);
    const items = [
      { id: 'pay-1', amount: 500, method: 'gpay', status: 'claimed', createdAt: '2026-09-20T10:00:00.000Z' },
      { id: 'pay-2', amount: 1200, method: 'phonepe', status: 'confirmed', createdAt: '2026-09-20T11:00:00.000Z' },
      { id: 'pay-1', amount: 500, method: 'gpay', status: 'confirmed', createdAt: '2026-09-20T10:00:00.000Z' },
    ];
    const body = JSON.stringify({ event: 'payment.backfill', data: { items } });
    expect(post(body, sign(body, secret))).toMatchObject({ ok: true, written: 3 });

    const rows = sheets.get('Payments')?.rows.slice(1) ?? [];
    expect(rows.map((row) => row[0])).toEqual(['pay-1', 'pay-2']);
    expect(rows[0]?.[3]).toBe('confirmed');
  });

  it('answers a connection test by writing to its own tab', () => {
    const { post, sheets } = loadScript(secret);
    const body = JSON.stringify({ event: 'test', data: {} });
    expect(post(body, sign(body, secret))).toMatchObject({ ok: true, test: true });
    expect(sheets.get('Vyapar QR')?.rows).toHaveLength(1);
  });

  it('acknowledges events it has no tab for without writing anything', () => {
    const { post, sheets } = loadScript(secret);
    const body = JSON.stringify({ event: 'subscription.updated', data: { id: 'x' } });
    expect(post(body, sign(body, secret))).toMatchObject({ ok: true, ignored: 'subscription.updated' });
    expect(sheets.size).toBe(0);
  });

  it('is the exact script the setup guide tells people to paste', () => {
    const doc = readFileSync(join(__dirname, '..', '..', '..', '..', 'docs', 'GOOGLE_SHEETS.md'), 'utf8');
    expect(doc).toContain(buildAppsScript(PLACEHOLDER_SECRET));
  });
});

/** The real WebhooksService, delivering over HTTP to a server that runs the
 * real script — the whole path a lead takes to a spreadsheet. */
describe('WebhooksService delivering to the Sheets connector', () => {
  const secret = 'webhook-secret';
  let server: ReturnType<typeof createServer>;
  let url = '';
  let script: ReturnType<typeof loadScript>;

  beforeAll(async () => {
    script = loadScript(secret);
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        // Exactly what Google gives doPost: the raw body and the query string.
        const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
        const reply = script.post(Buffer.concat(chunks).toString('utf8'), query.get('vqr_signature') ?? '');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(reply));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `http://localhost:${String((server.address() as AddressInfo).port)}/exec`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => { resolve(); }));
  });

  /** What the service last wrote to the webhook's delivery-status fields. */
  function lastRecorded(update: jest.Mock): { lastError: string | null } {
    const calls = update.mock.calls as [{ data: { lastError: string | null } }][];
    const last = calls.at(-1);
    if (!last) throw new Error('No delivery outcome was recorded');
    return last[0].data;
  }

  function serviceWith(webhook: Record<string, unknown>, data: { leads?: unknown[]; payments?: unknown[] } = {}) {
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      outboundWebhook: {
        findMany: jest.fn().mockResolvedValue([webhook]),
        findFirst: jest.fn().mockResolvedValue(webhook),
        update,
      },
      lead: { findMany: jest.fn().mockResolvedValue(data.leads ?? []) },
      paymentClaim: { findMany: jest.fn().mockResolvedValue(data.payments ?? []) },
    } as unknown as PrismaService;
    return { service: new WebhooksService(prisma), update };
  }

  const webhook = (over: Record<string, unknown> = {}) => ({
    id: 'wh-1',
    clientId: 'c-1',
    url,
    secret,
    eventTypes: ['lead.created', 'payment.claimed'],
    isActive: true,
    ...over,
  });

  it('delivers a lead that lands in the sheet', async () => {
    const { service, update } = serviceWith(webhook());
    await service.dispatch('c-1', 'lead.created', lead({ id: 'lead-http', name: 'Ravi' }));

    const row = script.sheets.get('Leads')?.rows.find((r: Cell[]) => r[0] === 'lead-http');
    expect(row?.[1]).toBe('Ravi');
    expect(lastRecorded(update).lastError).toBeNull();
  });

  it('records a wrong secret as the error, not as a successful delivery', async () => {
    // Apps Script cannot set an HTTP status, so this arrives as a 200.
    const { service, update } = serviceWith(webhook({ secret: 'not-the-scripts-secret' }));
    await service.dispatch('c-1', 'lead.created', lead({ id: 'lead-rejected' }));

    expect(script.sheets.get('Leads')?.rows.some((r: Cell[]) => r[0] === 'lead-rejected')).toBe(false);
    expect(lastRecorded(update).lastError).toMatch(/bad signature/);
  });

  it('only delivers the events a webhook subscribed to', async () => {
    const { service, update } = serviceWith(webhook({ eventTypes: ['payment.claimed'] }));
    await service.dispatch('c-1', 'lead.created', lead({ id: 'lead-unsubscribed' }));
    expect(update).not.toHaveBeenCalled();
  });

  it('reports a passing connection test', async () => {
    const { service } = serviceWith(webhook());
    await expect(service.sendTest('c-1', 'wh-1')).resolves.toMatchObject({ ok: true, error: null });
  });

  it('backfills existing leads and payments', async () => {
    const at = new Date('2026-09-01T09:00:00.000Z');
    const { service } = serviceWith(webhook(), {
      leads: [{ id: 'old-lead', name: 'Meera', phone: '9111', source: 'payment_claim', status: 'new', notes: null, tags: [], createdAt: at }],
      payments: [
        {
          id: 'old-pay',
          amount: 750,
          method: 'upi',
          status: 'confirmed',
          customerName: null,
          customerPhone: '9111',
          note: null,
          leadId: 'old-lead',
          confirmedAt: at,
          createdAt: at,
        },
      ],
    });

    await expect(service.backfill('c-1', 'wh-1')).resolves.toEqual({ leads: 1, payments: 1, failed: 0 });
    expect(script.sheets.get('Leads')?.rows.some((r) => r[0] === 'old-lead')).toBe(true);
    const payment = script.sheets.get('Payments')?.rows.find((r) => r[0] === 'old-pay');
    // A number, so the Amount column can be summed.
    expect(payment?.[1]).toBe(750);
  });
});
