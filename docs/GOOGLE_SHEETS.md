# Connecting Google Sheets

Vyapar QR can keep a Google Sheet up to date with a business's **leads (the CRM)**, **payments** and **customer feedback** — automatically, as they happen. No Google Cloud project, no API key and no developer account is needed: the business owner does it themselves in about five minutes, with the Google account they already have.

The same steps are in the dashboard under **Grow → Google Sheets**, with the owner's secret already filled into the script.

---

## How it works

```
Customer action              Vyapar QR                        Inside your Google Sheet
───────────────────────      ──────────────────               ───────────────────────────
Fills the contact form  ───► lead.created       ─┐
Pays, leaves a number   ───► lead.created        │
Messages on WhatsApp    ───► lead.created        │  signed      Apps Script checks the
Owner moves a lead      ───► lead.updated        ├──  POST ───► signature, then writes
Customer pays           ───► payment.claimed     │              the row into the Leads,
Owner confirms payment  ───► payment.updated     │              Payments or Feedback tab
Leaves feedback/review  ───► feedback.received  ─┘

You type reviews into   ◄─── reviews on your ──── signed GET, read back out of
the Reviews tab              landing page             the Reviews tab
```

- **One sheet, three tabs.** `Leads`, `Payments` and `Feedback` are created automatically the first time each is needed, each with a header row. You don't set up any columns.
- **Rows update — they don't pile up.** Every event carries the full record and its ID. When a lead moves from *new* to *won*, or a payment is confirmed, the existing row is updated in place. A delivery that arrives twice changes nothing.
- **Signed.** Every request is signed with a secret only you and Vyapar QR know. The script rejects anything that isn't, so knowing your script's URL is not enough to write to your sheet.

### What goes in each tab

| Tab | Columns |
|---|---|
| **Leads** | ID · Name · Phone · Source · Status · Notes · Tags · Created |
| **Payments** | ID · Amount (₹) · Paid with · Status · Customer · Phone · Note · Lead ID · Confirmed · Created |
| **Feedback** | ID · Rating · Type · Feedback / review · Customer notes · Received |
| **Reviews** | Name · Rating (1-5) · Review · Date — *you* fill this one; Vyapar QR reads it |

**Reviews work both ways.** The three tabs above are written *to*. The `Reviews` tab is read *from*: put your Google reviews there (name, rating, the text, the date) and they appear on your landing page — press **Get reviews from sheet** in the dashboard, and the nightly sync keeps it current. Rows without a name, or with a rating outside 1-5, are skipped. Reading is signed the same way as writing, with a timestamp that expires after ten minutes, so the URL alone gives nobody your reviews.

*Source* is where the lead came from: `contact_form`, `payment_claim` or `whatsapp_message`. A payment's *Status* is `claimed` (the customer says they paid), `confirmed` (you saw the money in your UPI app) or `cancelled`. A claimed payment is self-reported until you confirm it.

---

## Step by step

### 1. Create a sheet

Go to [sheets.new](https://sheets.new) and name it, e.g. *Vyapar QR — My Shop*. Leave it empty.

### 2. Open Apps Script

In the sheet, choose **Extensions → Apps Script**. A code editor opens in a new tab with a file called `Code.gs`.

### 3. Paste the script

Delete everything in `Code.gs` and paste the script. **Copy it from the dashboard if you can** — the dashboard fills in your secret for you. If you copy it from this page, replace `PASTE_YOUR_SECRET_HERE` with the secret shown in your dashboard.

Click **Save** (the disk icon).

### 4. Deploy it as a web app

1. Choose **Deploy → New deployment**.
2. Click the gear next to *Select type* and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
4. Click **Deploy**.
5. Google asks you to **Authorize access**. Pick your account. You'll see *"Google hasn't verified this app"* — that's expected for any script you write yourself. Choose **Advanced → Go to (your project) (unsafe) → Allow**. The script only touches this one spreadsheet.
6. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.

> **Why "Anyone"?** Vyapar QR's server sends the data, and it can't sign in to your Google account. "Anyone" lets it reach the script; the secret is what stops anyone else writing to your sheet.

### 5. Connect it in Vyapar QR

In the dashboard, open **Grow → Google Sheets**, paste the Web app URL and click **Connect**.

### 6. Test, then sync what you already have

- **Send test** — a tab called `Vyapar QR` appears in your sheet with a *"Connection test received"* row, and the dashboard shows *Connected*.
- **Sync existing data** — sends every lead and payment already in your CRM, so the sheet isn't empty until the next customer arrives. Safe to run again at any time.

From here on it's automatic.

---

## The script

```javascript
/**
 * Vyapar QR -> Google Sheets connector.
 *
 * Receives your leads, payments and customer feedback from Vyapar QR and
 * keeps one tab for each up to date. Paste this whole file into
 * Extensions > Apps Script, then Deploy > New deployment > Web app.
 */

// Your connector secret, from the Vyapar QR dashboard. Keep it private:
// anyone with it can write to this sheet.
const SECRET = 'PASTE_YOUR_SECRET_HERE';

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

```

---

## Troubleshooting

The dashboard shows the result of the last delivery next to the connection. Most problems are one of these:

| What you see | Cause | Fix |
|---|---|---|
| **bad signature** | The `SECRET` in the script doesn't match the dashboard | Copy the script again from the dashboard, paste it over the old one, then deploy a new version (below) |
| **HTTP 401 / 403**, or a Google sign-in page | *Who has access* isn't *Anyone* | **Deploy → Manage deployments → Edit**, set *Anyone*, deploy a new version |
| **HTTP 404** | The URL is wrong, or it's the `/dev` test URL | Use the URL ending in `/exec` from the deployment |
| **No answer within 10s** | Apps Script was slow to start, or the sheet is very large | Usually passes on the next event. Run **Sync existing data** to fill any gap |
| Test works, but new rows never appear | The script was edited without deploying a new version | Deploy a new version (below) |
| Phone numbers show as `9.19E+11` | The tab was created by hand | Delete the tab and let the script create it, or format the Phone column as *Plain text* |

**Changing the script?** Saving is not enough. Every change needs **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The URL stays the same.

**Rotating the secret?** Remove the connection in the dashboard and connect again. You get a new secret: paste the new script and deploy a new version.

---

## For developers

The connector is an ordinary Vyapar QR outbound webhook (`apps/api/src/webhooks`). Any endpoint can subscribe to the same events.

- **Body:** `{ "event": "lead.created", "data": { …full record… } }`. Backfill events (`lead.backfill`, `payment.backfill`) carry `{ "items": [ … ] }` in batches of 200.
- **Signature:** HMAC-SHA256 of the raw body with the webhook's secret, hex-encoded, sent as the `X-VyaparQR-Signature` header and as the `vqr_signature` query parameter. The query copy exists because Apps Script's `doPost` receives no request headers.
- **Receivers should upsert by `data.id`.** Events are not guaranteed to arrive exactly once or in order.
- **Delivery** is awaited with a 10-second timeout and never fails the action that triggered it. The last attempt's outcome is stored on the webhook (`lastDeliveredAt`, `lastStatus`, `lastError`). A receiver answering 200 with `{ "ok": false, "error": … }` is recorded as a failure — Apps Script cannot set an HTTP status, so that is how it reports one.
- **Source of truth for the script** is `buildAppsScript()` in `packages/types/src/sheets-apps-script.ts`. `apps/api/src/webhooks/sheets-apps-script.spec.ts` runs it against a stand-in for the Apps Script runtime, and fails if the copy on this page drifts from it.

### The other Google Sheets feature

Separately, **Reviews → Google Sheet sync** *reads* reviews from a sheet onto the landing page, using a Google **service account**. That needs `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` set on the API deployment and the sheet shared with that account. The connector above needs neither, and carries feedback too, so a business can use it on its own.
