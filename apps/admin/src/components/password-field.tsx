'use client';

import { useId, useState } from 'react';

export const MIN_PASSWORD_LENGTH = 8;

// No 0/O, 1/l/I: the password is usually read out or typed from a message.
const LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '@#$%&*!?';

/** A 12-character password with a letter, a capital, a digit and a symbol. */
export function generatePassword(): string {
  const pick = (set: string) => {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return set.charAt((buffer[0] ?? 0) % set.length);
  };
  const lower = LETTERS.slice(0, 23);
  const upper = LETTERS.slice(23);
  const all = LETTERS + DIGITS + SYMBOLS;
  const chars = [pick(lower), pick(upper), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < 12) chars.push(pick(all));
  // Shuffle so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    const j = (buffer[0] ?? 0) % (i + 1);
    [chars[i], chars[j]] = [chars[j] ?? '', chars[i] ?? ''];
  }
  return chars.join('');
}

const TONE_CLASS = { danger: 'text-danger', warning: 'text-warning', success: 'text-success' } as const;

function strength(value: string): { label: string; tone: 'danger' | 'warning' | 'success' } {
  if (value.length < MIN_PASSWORD_LENGTH) return { label: `At least ${String(MIN_PASSWORD_LENGTH)} characters`, tone: 'danger' };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((re) => re.test(value)).length;
  if (value.length >= 12 && kinds >= 3) return { label: 'Strong', tone: 'success' };
  return { label: 'OK — longer, with numbers and symbols, is stronger', tone: 'warning' };
}

/**
 * A password input for setting someone *else's* password: shown by default
 * (the Super Admin has to pass it on, so hiding it only invites typos), with
 * Generate and Copy beside it.
 */
export function PasswordField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const hint = strength(value);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          disabled={disabled}
          autoComplete="new-password"
          spellCheck={false}
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-describedby={`${id}-hint`}
          className="w-full rounded-md border border-border-color px-3 py-2 pr-16 font-mono"
        />
        <button
          type="button"
          onClick={() => {
            setVisible((prev) => !prev);
          }}
          className="absolute inset-y-0 right-0 min-w-14 cursor-pointer px-3 text-xs text-muted hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange(generatePassword());
            setVisible(true);
          }}
          className="min-h-9 cursor-pointer rounded-md border border-border-color px-3 text-xs disabled:opacity-50"
        >
          Generate strong password
        </button>
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={() => void copy()}
          className="min-h-9 min-w-16 cursor-pointer rounded-md border border-border-color px-3 text-xs disabled:opacity-50"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p id={`${id}-hint`} className={`text-xs ${value.length === 0 ? 'text-muted' : TONE_CLASS[hint.tone]}`}>
        {value.length === 0 ? `At least ${String(MIN_PASSWORD_LENGTH)} characters, or generate one.` : hint.label}
      </p>
    </div>
  );
}

/** Copies text and reports it, for the "share these details" boxes. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void (async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => {
              setCopied(false);
            }, 1600);
          } catch {
            setCopied(false);
          }
        })()
      }
      className="min-h-9 cursor-pointer rounded-md border border-border-color px-3 text-xs"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
