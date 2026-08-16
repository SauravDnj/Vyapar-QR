'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge, type BadgeTone } from '../../../components/ui/badge';
import { Drawer } from '../../../components/ui/drawer';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  downloadLeadsCsv,
  listLeads,
  requestLeadReview,
  sendLeadWhatsapp,
  updateLead,
  type Lead,
  type LeadSource,
  type LeadStatus,
} from '../../../lib/leads-api';

const STATUS_OPTIONS: LeadStatus[] = ['new', 'contacted', 'converted', 'lost'];
const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  lost: 'Lost',
};
const STATUS_TONE: Record<LeadStatus, BadgeTone> = {
  new: 'info',
  contacted: 'warning',
  converted: 'success',
  lost: 'danger',
};
const SOURCE_LABEL: Record<LeadSource, string> = {
  contact_form: 'Contact form',
  whatsapp_click: 'WhatsApp',
  qr_scan: 'QR scan',
};
const SOURCE_TONE: Record<LeadSource, BadgeTone> = {
  contact_form: 'info',
  whatsapp_click: 'success',
  qr_scan: 'neutral',
};

function maskPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length <= 4) return phone;
  const visibleStart = phone.slice(0, phone.length - digitsOnly.length + 2);
  const visibleEnd = phone.slice(-2);
  return `${visibleStart}${'•'.repeat(digitsOnly.length - 4)}${visibleEnd}`;
}

async function downloadBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

function LeadDrawer({
  lead,
  isOpen,
  onClose,
  onSave,
  onSendWhatsapp,
  onRequestReview,
}: {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: { status?: LeadStatus; notes?: string }) => Promise<void>;
  onSendWhatsapp: (id: string, message: string) => Promise<void>;
  onRequestReview: (id: string) => Promise<void>;
}) {
  const [displayLead, setDisplayLead] = useState(lead);
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? 'new');
  const [notes, setNotes] = useState(lead?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);
  const [isRequestingReview, setIsRequestingReview] = useState(false);

  // Adjust state during render when a new lead is selected, rather than in
  // an effect — this is React's recommended pattern for syncing state to a
  // changed prop and avoids an extra post-mount render.
  if (lead && lead !== displayLead) {
    setDisplayLead(lead);
    setStatus(lead.status);
    setNotes(lead.notes ?? '');
    setWhatsappMessage('');
  }

  async function handleSave() {
    if (!lead) return;
    setIsSaving(true);
    try {
      await onSave(lead.id, { status, notes });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendWhatsapp() {
    if (!lead || !whatsappMessage.trim()) return;
    setIsSendingWhatsapp(true);
    try {
      await onSendWhatsapp(lead.id, whatsappMessage.trim());
      setWhatsappMessage('');
    } finally {
      setIsSendingWhatsapp(false);
    }
  }

  async function handleRequestReview() {
    if (!lead) return;
    setIsRequestingReview(true);
    try {
      await onRequestReview(lead.id);
    } finally {
      setIsRequestingReview(false);
    }
  }

  if (!displayLead) {
    return <Drawer isOpen={isOpen} onClose={onClose}>{null}</Drawer>;
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold">{displayLead.name}</p>
          <p className="font-mono text-sm text-muted">{displayLead.phone}</p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close drawer">
          ✕
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone={SOURCE_TONE[displayLead.source]}>{SOURCE_LABEL[displayLead.source]}</Badge>
        <Badge tone={STATUS_TONE[displayLead.status]}>{STATUS_LABEL[displayLead.status]}</Badge>
      </div>

      <p className="font-mono text-xs text-muted">Received {new Date(displayLead.createdAt).toLocaleString()}</p>

      {displayLead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {displayLead.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as LeadStatus)}
          className="rounded-md border border-border-color px-3 py-2"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABEL[option]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-1 flex-col gap-1 text-sm">
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={6}
          className="flex-1 rounded-md border border-border-color px-3 py-2"
        />
      </label>

      <button
        disabled={isSaving}
        onClick={() => void handleSave()}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Save changes'}
      </button>

      <div className="flex flex-col gap-2 border-t border-border-color pt-4">
        <p className="text-sm font-medium">WhatsApp</p>
        <div className="flex gap-2">
          <input
            value={whatsappMessage}
            onChange={(event) => setWhatsappMessage(event.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-md border border-border-color px-3 py-2 text-sm"
          />
          <button
            disabled={isSendingWhatsapp || !whatsappMessage.trim()}
            onClick={() => void handleSendWhatsapp()}
            className="rounded-md border border-border-color px-3 py-2 text-sm disabled:opacity-50"
          >
            {isSendingWhatsapp ? 'Sending…' : 'Send'}
          </button>
        </div>
        <button
          disabled={isRequestingReview}
          onClick={() => void handleRequestReview()}
          className="w-fit rounded-md border border-border-color px-3 py-2 text-sm disabled:opacity-50"
        >
          {isRequestingReview ? 'Sending…' : 'Request Google review on WhatsApp'}
        </button>
      </div>
    </Drawer>
  );
}

type ViewMode = 'list' | 'board';

/** P4-02 — kanban board view. Plain HTML5 drag-and-drop (no new dependency);
 * dropping a card on a column reuses the same status-update path the list
 * view's drawer already uses. */
function LeadsBoard({
  leads,
  onStatusChange,
  onSelect,
}: {
  leads: Lead[];
  onStatusChange: (lead: Lead, status: LeadStatus) => void;
  onSelect: (lead: Lead) => void;
}) {
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function handleDrop(event: React.DragEvent<HTMLDivElement>, status: LeadStatus) {
    event.preventDefault();
    setDragOverColumn(null);
    const leadId = event.dataTransfer.getData('text/plain');
    const lead = leads.find((entry) => entry.id === leadId);
    if (lead && lead.status !== status) {
      onStatusChange(lead, status);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATUS_OPTIONS.map((status) => {
        const columnLeads = leads.filter((lead) => lead.status === status);
        const isDragOver = dragOverColumn === status;
        return (
          <div
            key={status}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverColumn(status);
            }}
            onDragLeave={() => setDragOverColumn((prev) => (prev === status ? null : prev))}
            onDrop={(event) => handleDrop(event, status)}
            className={`flex min-h-48 flex-col gap-2 rounded-lg border p-3 transition-colors ${
              isDragOver ? 'border-accent bg-accent/5' : 'border-border-color bg-surface'
            }`}
          >
            <div className="flex items-center justify-between px-1">
              <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
              <span className="font-mono text-xs text-muted">{columnLeads.length}</span>
            </div>
            {columnLeads.map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(event) => {
                  setDraggingId(lead.id);
                  event.dataTransfer.setData('text/plain', lead.id);
                }}
                onDragEnd={() => setDraggingId(null)}
                onClick={() => onSelect(lead)}
                className={`flex cursor-grab flex-col gap-1.5 rounded-md border border-border-color bg-background p-3 text-sm shadow-sm transition-all duration-150 hover:-translate-y-0.5 active:cursor-grabbing ${
                  draggingId === lead.id ? 'opacity-40' : 'opacity-100'
                }`}
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <p className="font-medium">{lead.name}</p>
                <p className="font-mono text-xs text-muted">{maskPhone(lead.phone)}</p>
                <Badge tone={SOURCE_TONE[lead.source]}>{SOURCE_LABEL[lead.source]}</Badge>
              </div>
            ))}
            {columnLeads.length === 0 && <p className="px-1 text-xs text-muted">No leads</p>}
          </div>
        );
      })}
    </div>
  );
}

function LeadsContent() {
  const { accessToken } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await listLeads(accessToken, {
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setLeads(result.data);
      setTotal(result.total);
    } catch {
      setMessage('Failed to load leads.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, statusFilter, search]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleSaveLead(id: string, data: { status?: LeadStatus; notes?: string }) {
    if (!accessToken) return;
    try {
      const updated = await updateLead(accessToken, id, data);
      setLeads((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to update lead.');
    }
  }

  async function handleSendWhatsapp(id: string, whatsappMessage: string) {
    if (!accessToken) return;
    try {
      const result = await sendLeadWhatsapp(accessToken, id, whatsappMessage);
      setMessage(result.sent ? null : 'WhatsApp is not configured on this deployment yet.');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to send WhatsApp message.');
    }
  }

  async function handleRequestReview(id: string) {
    if (!accessToken) return;
    try {
      const result = await requestLeadReview(accessToken, id);
      setMessage(result.sent ? null : 'WhatsApp is not configured on this deployment yet.');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to send review request.');
    }
  }

  async function handleExport() {
    if (!accessToken) return;
    try {
      const blob = await downloadLeadsCsv(accessToken);
      await downloadBlob(blob, 'leads.csv');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to export leads.');
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Leads</h1>
      {message && <p className="text-sm text-danger">{message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-border-color font-mono text-sm">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 ${statusFilter === '' ? 'bg-accent text-accent-foreground' : ''}`}
          >
            All
          </button>
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`border-l border-border-color px-3 py-1.5 ${statusFilter === status ? 'bg-accent text-accent-foreground' : ''}`}
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or phone"
          className="rounded-md border border-border-color px-3 py-1.5 text-sm"
        />
        <button onClick={() => void handleExport()} className="rounded-md border border-border-color px-3 py-1.5 text-sm">
          Export CSV
        </button>
        <div className="flex overflow-hidden rounded-md border border-border-color font-mono text-sm">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 ${view === 'list' ? 'bg-accent text-accent-foreground' : ''}`}
          >
            List
          </button>
          <button
            onClick={() => setView('board')}
            className={`border-l border-border-color px-3 py-1.5 ${view === 'board' ? 'bg-accent text-accent-foreground' : ''}`}
          >
            Board
          </button>
        </div>
        <p className="text-sm text-muted">{total} total</p>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : leads.length === 0 ? (
        <p className="text-muted">No leads yet.</p>
      ) : view === 'board' ? (
        <LeadsBoard
          leads={leads}
          onStatusChange={(lead, status) => void handleSaveLead(lead.id, { status })}
          onSelect={setSelectedLead}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-color bg-surface" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-color font-mono text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="cursor-pointer border-b border-border-color last:border-0 hover:bg-border-color/20"
                >
                  <td className="px-4 py-3 font-medium">{lead.name}</td>
                  <td className="px-4 py-3 font-mono">{maskPhone(lead.phone)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={SOURCE_TONE[lead.source]}>{SOURCE_LABEL[lead.source]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">{new Date(lead.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeadDrawer
        lead={selectedLead}
        isOpen={selectedLead !== null}
        onClose={() => setSelectedLead(null)}
        onSave={handleSaveLead}
        onSendWhatsapp={handleSendWhatsapp}
        onRequestReview={handleRequestReview}
      />
    </>
  );
}

export default function LeadsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <LeadsContent />
    </ProtectedRoute>
  );
}
