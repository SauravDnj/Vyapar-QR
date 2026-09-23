/**
 * The Google Apps Script a client pastes into their spreadsheet to receive
 * Vyapar QR's webhooks.
 *
 * It lives here, not in the admin app, because two places show it and they
 * must never disagree: the admin's "Connect Google Sheets" page (with the
 * client's real secret filled in) and `docs/GOOGLE_SHEETS.md` (with a
 * placeholder). A test in the API asserts the doc contains exactly
 * `buildAppsScript(PLACEHOLDER_SECRET)`.
 *
 * What the script does, and why each part is there:
 *
 * - **Verifies the signature.** A deployed script URL accepts a POST from
 *   anyone who has it. The signature is an HMAC of the exact request body,
 *   read from the query string because `doPost` is never given the request
 *   headers. Computed over the raw bytes with UTF-8 stated explicitly —
 *   Node signs UTF-8, and a Hindi customer name signed any other way fails.
 * - **Upserts by id.** Every event carries the whole record, so "created" and
 *   "updated" are the same write: find the row with that id, overwrite it,
 *   or append. A delivery that arrives twice changes nothing.
 * - **Holds a lock.** Two customers paying in the same second are two
 *   concurrent runs; without the lock both read "no row for this id" and
 *   both append.
 * - **Creates its own tabs.** Leads, Payments and Feedback appear the first
 *   time they're needed, with a header row, so there is no sheet layout for
 *   anyone to get wrong.
 * - **Keeps phone numbers as text.** Otherwise Sheets reads 919820011223 as
 *   a number and shows 9.19820E+11.
 */

export const PLACEHOLDER_SECRET = 'PASTE_YOUR_SECRET_HERE';

export function buildAppsScript(secret: string): string {
  return `/**
 * Vyapar QR -> Google Sheets connector.
 *
 * Receives your leads, payments and customer feedback from Vyapar QR and
 * keeps one tab for each up to date. Paste this whole file into
 * Extensions > Apps Script, then Deploy > New deployment > Web app.
 */

// Your connector secret, from the Vyapar QR dashboard. Keep it private:
// anyone with it can write to this sheet.
const SECRET = '${secret}';

// Reviews you want shown on your page. Paste them in this tab (or let the
// Google review form fill it) and Vyapar QR reads them from here.
const REVIEWS_TAB = {
  name: 'Reviews',
  columns: ['name', 'rating', 'comment', 'date'],
  headers: ['Name', 'Rating (1-5)', 'Review', 'Date'],
};

const TABS = {
  lead: {
    name: 'Leads',
    columns: ['id', 'name', 'phone', 'source', 'status', 'notes', 'tags', 'createdAt'],
    headers: ['ID', 'Name', 'Phone', 'Source', 'Status', 'Notes', 'Tags', 'Created'],
  },
  payment: {
    name: 'Payments',
    columns: ['id', 'amount', 'method', 'status', 'customerName', 'customerPhone', 'note', 'leadId', 'confirmedAt', 'createdAt'],
    headers: ['ID', 'Amount (₹)', 'Paid with', 'Status', 'Customer', 'Phone', 'Note', 'Lead ID', 'Confirmed', 'Created'],
  },
  feedback: {
    name: 'Feedback',
    columns: ['id', 'rating', 'type', 'text', 'customerNotes', 'createdAt'],
    headers: ['ID', 'Rating', 'Type', 'Feedback / review', 'Customer notes', 'Received'],
  },
};

// Which tab each event is written to. Anything else is acknowledged and ignored.
const ROUTES = {
  'lead.created': 'lead',
  'lead.updated': 'lead',
  'lead.backfill': 'lead',
  'payment.claimed': 'payment',
  'payment.updated': 'payment',
  'payment.backfill': 'payment',
  'feedback.received': 'feedback',
};

// Stored as text, so a phone number is not turned into 9.19820E+11.
const TEXT_COLUMNS = ['id', 'phone', 'customerPhone', 'leadId'];

function doPost(e) {
  try {
    const body = e && e.postData ? e.postData.contents : '';
    const signature = e && e.parameter ? e.parameter.vqr_signature : '';
    if (!body || !isSigned(body, signature)) {
      return reply({ ok: false, error: 'bad signature - check the SECRET in this script' });
    }

    const message = JSON.parse(body);
    if (message.event === 'test') {
      logTest();
      return reply({ ok: true, test: true });
    }

    const kind = ROUTES[message.event];
    if (!kind) {
      return reply({ ok: true, ignored: message.event });
    }

    const data = message.data || {};
    const items = Array.isArray(data.items) ? data.items : [data];

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      upsert(TABS[kind], items);
    } finally {
      lock.releaseLock();
    }
    return reply({ ok: true, written: items.length });
  } catch (error) {
    return reply({ ok: false, error: String(error) });
  }
}

/**
 * Opening the web app URL in a browser shows a plain line, which is how you
 * can tell the deployment itself is working.
 *
 * Vyapar QR also reads your Reviews tab back through this same URL, so the
 * reviews on your page come from this sheet with nothing else to set up. A
 * GET carries no body to sign, so the signature covers "reviews:<timestamp>"
 * and anything older than ten minutes is refused — a copied URL cannot be
 * replayed later.
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.vqr_action !== 'reviews') {
    return ContentService.createTextOutput('Vyapar QR connector is running. Paste this URL into your Vyapar QR dashboard.');
  }
  const stamp = String(params.vqr_ts || '');
  if (!isSigned('reviews:' + stamp, params.vqr_signature || '')) {
    return reply({ ok: false, error: 'bad signature - check the SECRET in this script' });
  }
  const age = Math.abs(Date.now() - Number(stamp));
  if (!stamp || isNaN(age) || age > 10 * 60 * 1000) {
    return reply({ ok: false, error: 'stale request' });
  }
  return reply({ ok: true, reviews: readReviews() });
}

function readReviews() {
  const sheet = sheetFor(REVIEWS_TAB);
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, REVIEWS_TAB.columns.length).getValues();
  const out = [];
  values.forEach(function (row) {
    const name = String(row[0] === null || row[0] === undefined ? '' : row[0]).trim();
    const rating = Number(row[1]);
    // A half-typed row is skipped rather than shown as a nameless 0-star.
    if (!name || !rating || rating < 1 || rating > 5) return;
    const date = row[3] instanceof Date ? row[3] : row[3] ? new Date(row[3]) : null;
    out.push({
      name: name,
      rating: rating,
      comment: String(row[2] === null || row[2] === undefined ? '' : row[2]).trim(),
      date: date && !isNaN(date.getTime()) ? date.toISOString() : null,
    });
  });
  return out;
}

function isSigned(body, signature) {
  if (!signature) return false;
  const bytes = Utilities.computeHmacSha256Signature(body, SECRET, Utilities.Charset.UTF_8);
  const hex = bytes
    .map(function (b) {
      return ('0' + (b & 0xff).toString(16)).slice(-2);
    })
    .join('');
  return hex === signature;
}

function upsert(tab, items) {
  const sheet = sheetFor(tab);
  const width = tab.columns.length;
  const last = sheet.getLastRow();

  // Row number (1-based) of every id already in the sheet.
  const rowOf = {};
  if (last > 1) {
    sheet
      .getRange(2, 1, last - 1, 1)
      .getValues()
      .forEach(function (row, i) {
        rowOf[String(row[0])] = i + 2;
      });
  }

  const appends = [];
  const appendAt = {};
  items.forEach(function (item) {
    if (!item || item.id === undefined || item.id === null) return;
    const id = String(item.id);
    const row = tab.columns.map(function (column) {
      return toCell(column, item[column]);
    });
    if (rowOf[id]) {
      sheet.getRange(rowOf[id], 1, 1, width).setValues([row]);
    } else if (appendAt[id] !== undefined) {
      appends[appendAt[id]] = row; // same id twice in one batch: keep the newer
    } else {
      appendAt[id] = appends.length;
      appends.push(row);
    }
  });

  if (appends.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appends.length, width).setValues(appends);
  }
}

function sheetFor(tab) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(tab.name);
  if (sheet) return sheet;

  sheet = book.insertSheet(tab.name);
  sheet.getRange(1, 1, 1, tab.headers.length).setValues([tab.headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  tab.columns.forEach(function (column, i) {
    if (TEXT_COLUMNS.indexOf(column) !== -1) {
      sheet.getRange(1, i + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
    }
  });
  return sheet;
}

function toCell(column, value) {
  if (value === null || value === undefined) return '';
  // ISO timestamps become real dates, so the column sorts and filters by date.
  if (/At$/.test(column) && typeof value === 'string' && value) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date;
  }
  return value;
}

function logTest() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName('Vyapar QR') || book.insertSheet('Vyapar QR');
  sheet.appendRow([new Date(), 'Connection test received - your sheet is connected.']);
}

function reply(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
`;
}
