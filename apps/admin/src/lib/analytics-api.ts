import { ApiError, apiFetch } from './api-client';

export interface AnalyticsSummary {
  pageViews: number;
  buttonClicks: number;
  qrScans: number;
  whatsappClicks: number;
}

export interface TimeseriesPoint {
  date: string;
  pageViews: number;
  buttonClicks: number;
  qrScans: number;
}

export function getAnalyticsSummary(accessToken: string) {
  return apiFetch<AnalyticsSummary>('/analytics/summary', { accessToken });
}

export function getAnalyticsTimeseries(accessToken: string, days: number) {
  return apiFetch<TimeseriesPoint[]>(`/analytics/timeseries?days=${String(days)}`, { accessToken });
}

export interface FunnelStage {
  stage: string;
  count: number;
}

export function getAnalyticsFunnel(accessToken: string, days: number) {
  return apiFetch<FunnelStage[]>(`/analytics/funnel?days=${String(days)}`, { accessToken });
}

export function getAdminAnalyticsTimeseries(accessToken: string, days: number) {
  return apiFetch<TimeseriesPoint[]>(`/admin/analytics/timeseries?days=${String(days)}`, { accessToken });
}

export { ApiError };
