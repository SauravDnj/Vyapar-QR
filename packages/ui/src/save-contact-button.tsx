'use client';

function buildVCard(businessName: string, phone: string | undefined, address: string | undefined, url: string): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${businessName}`,
    `ORG:${businessName}`,
  ];
  if (phone) lines.push(`TEL;TYPE=WORK,VOICE:${phone}`);
  if (address) lines.push(`ADR;TYPE=WORK:;;${address};;;;`);
  lines.push(`URL:${url}`, 'END:VCARD');
  return lines.join('\r\n');
}

/** One-tap "Save Contact" — builds a `.vcf` file client-side from data the
 * page already has (no backend round trip needed) and downloads it. */
export function SaveContactButton({
  businessName,
  phone,
  address,
}: {
  businessName: string;
  phone?: string;
  address?: string;
}) {
  function handleClick() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const vCard = buildVCard(businessName, phone, address, url);
    const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.vcf`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-full border px-5 py-2 text-sm font-medium transition hover:bg-gray-50"
    >
      Save contact
    </button>
  );
}
