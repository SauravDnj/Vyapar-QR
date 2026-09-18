/**
 * Writes a QR image and a printable A5 poster for a live page.
 *
 * The product generates these per client inside the dashboard; this is the
 * same two libraries, run from the command line, so a demo QR can be produced
 * and committed without logging in.
 *
 *   node scripts/demo-qr.js <url> <business name> <out-dir>
 */
const fs = require('node:fs');
const path = require('node:path');

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const [, , url, businessName, outDir] = process.argv;

if (!url || !businessName) {
  console.error('Usage: node scripts/demo-qr.js <url> <business name> [out-dir]');
  process.exitCode = 1;
  return;
}

const target = outDir ?? path.join(__dirname, '..', '..', '..', 'docs', 'demo');
const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function main() {
  fs.mkdirSync(target, { recursive: true });

  const pngPath = path.join(target, `${slug}-qr.png`);
  await QRCode.toFile(pngPath, url, { width: 1024, margin: 1, errorCorrectionLevel: 'M' });

  // A poster someone can actually print and stand on a counter: the QR big
  // enough to scan from arm's length, one instruction, and the link written
  // out for anyone who would rather type it.
  const posterPath = path.join(target, `${slug}-qr-poster.pdf`);
  const doc = new PDFDocument({ size: 'A5', margin: 36 });
  doc.pipe(fs.createWriteStream(posterPath));

  const width = doc.page.width - 72;
  doc.fontSize(26).fillColor('#14181f').text(businessName, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor('#667085').text('Scan to pay, review us or chat on WhatsApp', { align: 'center' });

  const qrBuffer = await QRCode.toBuffer(url, { width: 900, margin: 1, errorCorrectionLevel: 'M' });
  const size = Math.min(width, 300);
  doc.image(qrBuffer, (doc.page.width - size) / 2, doc.y + 18, { width: size });

  doc.y += size + 34;
  doc.fontSize(10).fillColor('#667085').text(url, { align: 'center', link: url, underline: false });
  doc.moveDown(1);
  doc.fontSize(9).fillColor('#98a2b3').text('Powered by Vyapar QR', { align: 'center' });
  doc.end();

  console.log(`QR:     ${pngPath}`);
  console.log(`Poster: ${posterPath}`);
  console.log(`Points at: ${url}`);
}

void main();
