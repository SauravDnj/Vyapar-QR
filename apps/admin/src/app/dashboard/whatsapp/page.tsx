'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  broadcastWhatsapp,
  getWhatsappConversation,
  getWhatsappSettings,
  listWhatsappConversations,
  sendWhatsappMessage,
  updateWhatsappSettings,
  type LeadStatus,
  type WhatsappMessage,
  type WhatsappSettings,
} from '../../../lib/whatsapp-api';

const BROADCAST_STATUS_OPTIONS: { value: LeadStatus | ''; label: string }[] = [
  { value: '', label: 'All leads' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

function BroadcastPanel({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [message, setMessage] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim() && !aiPrompt.trim()) {
      setError('Write a message, or an AI prompt to draft one.');
      return;
    }
    setIsSending(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await broadcastWhatsapp(accessToken, {
        status: status || undefined,
        message: message.trim() || undefined,
        aiPrompt: message.trim() ? undefined : aiPrompt.trim(),
      });
      setResult(`Sent to ${String(outcome.sent)} of ${String(outcome.total)} matching leads.`);
      setMessage('');
      setAiPrompt('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send broadcast.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div>
        <p className="font-medium">Broadcast</p>
        <p className="text-sm text-muted">Send one WhatsApp message to a segment of your leads.</p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Send to
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus | '')}
          className="rounded border border-border-color bg-background px-3 py-2"
        >
          {BROADCAST_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Message
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write the exact message to send…"
          className="rounded border border-border-color bg-background px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Or let AI draft it from a prompt (used only if the message above is blank)
        <input
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="e.g. announce our weekend sale"
          className="rounded border border-border-color bg-background px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}
      {result && <p className="text-sm text-muted">{result}</p>}

      <button
        onClick={() => void handleSend()}
        disabled={isSending}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground disabled:opacity-50"
      >
        {isSending ? 'Sending…' : 'Send broadcast'}
      </button>
    </div>
  );
}

const EMPTY_SETTINGS: WhatsappSettings = { isEnabled: false, aiChatbotEnabled: false, systemPromptOverride: null, sendMode: 'auto' };

const SEND_MODE_OPTIONS: { value: WhatsappSettings['sendMode']; label: string; hint: string }[] = [
  {
    value: 'auto',
    label: 'Auto (recommended)',
    hint: 'Uses the Meta API when it’s connected; otherwise falls back to a WhatsApp link the customer/you send manually.',
  },
  {
    value: 'api',
    label: 'Meta API only',
    hint: 'Only ever tries the connected Meta API. Requires WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID set on the server.',
  },
  {
    value: 'url',
    label: 'WhatsApp link only',
    hint: 'Always opens a wa.me link for a human to send — even if the Meta API is connected. No credentials ever needed.',
  },
];

function SettingsPanel({ accessToken }: { accessToken: string }) {
  const [settings, setSettings] = useState<WhatsappSettings>(EMPTY_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setSettings(await getWhatsappSettings(accessToken));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken]);

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);
    try {
      await updateWhatsappSettings(accessToken, settings);
      setMessage('Saved.');
    } catch {
      setMessage('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div>
        <p className="font-medium">WhatsApp settings</p>
        <p className="text-sm text-muted">
          Sent and received through QRHub&apos;s shared WhatsApp Business number. Customers see your business name in
          every message.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.isEnabled}
          onChange={(e) => setSettings({ ...settings, isEnabled: e.target.checked })}
        />
        Enable WhatsApp for this business
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">How should messages actually get sent?</p>
        {SEND_MODE_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-start gap-2">
            <input
              type="radio"
              name="sendMode"
              disabled={!settings.isEnabled}
              checked={settings.sendMode === option.value}
              onChange={() => setSettings({ ...settings, sendMode: option.value })}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={!settings.isEnabled || settings.sendMode === 'url'}
          checked={settings.aiChatbotEnabled}
          onChange={(e) => setSettings({ ...settings, aiChatbotEnabled: e.target.checked })}
        />
        Auto-reply with AI chatbot when a customer messages
      </label>
      {settings.sendMode === 'url' ? (
        <p className="-mt-2 text-xs text-muted">
          Not available in &quot;WhatsApp link only&quot; mode — a wa.me link is one-way (opens a draft for a human to
          send), so there&apos;s no way for us to receive a customer&apos;s reply to auto-answer it. The chatbot needs
          the Meta API connected.
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        Custom instructions for the AI (optional)
        <textarea
          rows={3}
          disabled={!settings.isEnabled}
          value={settings.systemPromptOverride ?? ''}
          onChange={(e) => setSettings({ ...settings, systemPromptOverride: e.target.value || null })}
          placeholder="e.g. Always mention we're closed on Mondays. Never quote exact prices."
          className="rounded border border-border-color bg-background px-3 py-2 disabled:opacity-50"
        />
      </label>

      {message && <p className="text-sm text-muted">{message}</p>}

      <button
        onClick={() => void handleSave()}
        disabled={isSaving}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}

function ConversationThread({
  accessToken,
  phone,
  onSent,
}: {
  accessToken: string;
  phone: string;
  onSent: () => void;
}) {
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setMessages(await getWhatsappConversation(accessToken, phone));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, phone]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await sendWhatsappMessage(accessToken, phone, reply.trim());
      setReply('');
      await refresh();
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="font-mono text-sm font-medium">+{phone}</p>

      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                message.direction === 'outbound'
                  ? 'ml-auto bg-accent text-accent-foreground'
                  : 'bg-border-color/30 text-foreground'
              }`}
            >
              <p>{message.body}</p>
              <p className={`mt-1 text-[10px] ${message.direction === 'outbound' ? 'text-accent-foreground/70' : 'text-muted'}`}>
                {new Date(message.createdAt).toLocaleString()}
                {message.isAiGenerated ? ' · AI' : ''}
              </p>
            </div>
          ))
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <form onSubmit={(e) => void handleSend(e)} className="flex gap-2">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type a reply…"
          className="flex-1 rounded border border-border-color bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isSending}
          className="rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground disabled:opacity-50"
        >
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}

function WhatsappContent() {
  const { accessToken } = useAuth();
  const [conversations, setConversations] = useState<WhatsappMessage[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshConversations = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      setConversations(await listWhatsappConversations(accessToken));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refreshConversations();
    })();
  }, [refreshConversations]);

  if (!accessToken) return null;

  return (
    <>
      <h1 className="text-2xl font-semibold">WhatsApp</h1>
      <p className="text-sm text-muted">
        Message leads directly, request Google reviews, and let an AI chatbot answer common questions when you&apos;re
        away.
      </p>

      <SettingsPanel accessToken={accessToken} />
      <BroadcastPanel accessToken={accessToken} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-2 rounded-lg border border-border-color bg-surface p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="px-1 text-sm font-medium">Conversations</p>
          {isLoading ? (
            <p className="px-1 text-sm text-muted">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="px-1 text-sm text-muted">
              No conversations yet — send a message from a lead, or request a review, to start one.
            </p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.phone}
                onClick={() => setSelectedPhone(conversation.phone)}
                className={`flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-border-color/30 ${
                  selectedPhone === conversation.phone ? 'bg-border-color/40' : ''
                }`}
              >
                <span className="flex w-full items-center justify-between gap-2 font-mono text-xs">
                  +{conversation.phone}
                  {conversation.needsHuman ? (
                    <Badge tone="warning">needs you</Badge>
                  ) : conversation.direction === 'inbound' ? (
                    <Badge tone="info">new</Badge>
                  ) : null}
                </span>
                <span className="line-clamp-1 text-xs text-muted">{conversation.body}</span>
              </button>
            ))
          )}
        </div>

        {selectedPhone ? (
          <ConversationThread accessToken={accessToken} phone={selectedPhone} onSent={() => void refreshConversations()} />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border-color p-8 text-sm text-muted">
            Select a conversation to view messages.
          </div>
        )}
      </div>
    </>
  );
}

export default function WhatsappPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <WhatsappContent />
    </ProtectedRoute>
  );
}
