import { ApiError, apiFetch } from './api-client';

export interface WhatsappSettings {
  isEnabled: boolean;
  aiChatbotEnabled: boolean;
  systemPromptOverride: string | null;
}

export interface WhatsappMessage {
  id: string;
  clientId: string | null;
  phone: string;
  direction: 'inbound' | 'outbound';
  body: string;
  isAiGenerated: boolean;
  needsHuman: boolean;
  createdAt: string;
}

export function getWhatsappSettings(accessToken: string) {
  return apiFetch<WhatsappSettings>('/whatsapp/settings', { accessToken });
}

export function updateWhatsappSettings(accessToken: string, settings: WhatsappSettings) {
  return apiFetch<WhatsappSettings>('/whatsapp/settings', { method: 'PUT', body: settings, accessToken });
}

export function listWhatsappConversations(accessToken: string) {
  return apiFetch<WhatsappMessage[]>('/whatsapp/conversations', { accessToken });
}

export function getWhatsappConversation(accessToken: string, phone: string) {
  return apiFetch<WhatsappMessage[]>(`/whatsapp/conversations/${encodeURIComponent(phone)}`, { accessToken });
}

export function sendWhatsappMessage(accessToken: string, phone: string, body: string) {
  return apiFetch<{ sent: boolean }>('/whatsapp/send', { method: 'POST', body: { phone, body }, accessToken });
}

export type LeadStatus = 'new' | 'contacted' | 'converted' | 'lost';

export function broadcastWhatsapp(
  accessToken: string,
  data: { status?: LeadStatus; message?: string; aiPrompt?: string },
) {
  return apiFetch<{ sent: number; total: number }>('/whatsapp/broadcast', { method: 'POST', body: data, accessToken });
}

export { ApiError };
