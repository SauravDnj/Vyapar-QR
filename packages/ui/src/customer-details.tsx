'use client';

import { useEffect, useState } from 'react';

import type { CSSProperties } from 'react';

/**
 * The customer's name and phone number, asked for on the review and payment
 * screens so the owner's Google Sheet shows who each row is.
 *
 * Always optional, and never read from anywhere but the customer's own typing:
 * a web page cannot see a visitor's number or accounts. What makes it quick is
 * `autocomplete="name"` / `"tel"`, which lets the phone offer its saved
 * details in one tap, and remembering what they typed on this device, so a
 * returning customer finds it already filled in.
 */
export interface CustomerDetails {
  name: string;
  phone: string;
}

const STORAGE_KEY = 'vqr.customer';

export function readRememberedCustomer(): CustomerDetails {
  try {
    // Whatever is stored may be stale or hand-edited, so each field is checked.
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as { name?: unknown; phone?: unknown } | null;
    return {
      name: typeof saved?.name === 'string' ? saved.name.slice(0, 80) : '',
      phone: typeof saved?.phone === 'string' ? cleanPhone(saved.phone) : '',
    };
  } catch {
    return { name: '', phone: '' };
  }
}

export function rememberCustomer(details: CustomerDetails) {
  const name = details.name.trim();
  const phone = details.phone.trim();
  if (!name && !phone) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }));
  } catch {
    // Private mode or blocked storage: they type it again next time.
  }
}

/** Filled from this device's last entry after mount (never during render, so
 * the server and client markup match). */
export function useCustomerDetails(): [CustomerDetails, (next: CustomerDetails) => void] {
  const [details, setDetails] = useState<CustomerDetails>({ name: '', phone: '' });
  useEffect(() => {
    const saved = readRememberedCustomer();
    if (saved.name || saved.phone) setDetails(saved);
  }, []);
  return [details, setDetails];
}

/** Digits, spaces and a leading +, at most 20 characters — what the API accepts. */
export function cleanPhone(value: string): string {
  return value.replace(/[^\d+\s-]/g, '').slice(0, 20);
}

export function CustomerDetailsFields({
  idPrefix,
  value,
  onChange,
  inputClassName,
  inputStyle,
  labelClassName,
  labelStyle,
}: {
  /** Keeps the label/input ids unique when two forms are on one page. */
  idPrefix: string;
  value: CustomerDetails;
  onChange: (next: CustomerDetails) => void;
  inputClassName: string;
  inputStyle?: CSSProperties;
  labelClassName: string;
  labelStyle?: CSSProperties;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-name`} className={labelClassName} style={labelStyle}>
          Your name
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          autoComplete="name"
          maxLength={80}
          value={value.name}
          onChange={(event) => {
            onChange({ ...value, name: event.target.value });
          }}
          placeholder="e.g. Priya Shah"
          className={inputClassName}
          style={inputStyle}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-phone`} className={labelClassName} style={labelStyle}>
          Phone number
        </label>
        <input
          id={`${idPrefix}-phone`}
          name="tel"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          value={value.phone}
          onChange={(event) => {
            onChange({ ...value, phone: cleanPhone(event.target.value) });
          }}
          placeholder="e.g. 98200 11223"
          className={inputClassName}
          style={inputStyle}
        />
      </div>
    </div>
  );
}
