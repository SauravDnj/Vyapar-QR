import { ApiError, apiFetch } from './api-client';

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceRupees: string;
  imageUrl: string | null;
  isAvailable: boolean;
  displayOrder: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  items: MenuItem[];
}

export function listMenuCategories(accessToken: string) {
  return apiFetch<MenuCategory[]>('/menu/categories', { accessToken });
}

export function createMenuCategory(accessToken: string, data: { name: string }) {
  return apiFetch<MenuCategory>('/menu/categories', { method: 'POST', accessToken, body: data });
}

export function updateMenuCategory(accessToken: string, id: string, data: { name?: string; displayOrder?: number }) {
  return apiFetch<MenuCategory>(`/menu/categories/${id}`, { method: 'PATCH', accessToken, body: data });
}

export function deleteMenuCategory(accessToken: string, id: string) {
  return apiFetch<void>(`/menu/categories/${id}`, { method: 'DELETE', accessToken });
}

export function createMenuItem(
  accessToken: string,
  categoryId: string,
  data: { name: string; description?: string; priceRupees: number; imageUrl?: string; isAvailable?: boolean },
) {
  return apiFetch<MenuItem>(`/menu/categories/${categoryId}/items`, { method: 'POST', accessToken, body: data });
}

export function updateMenuItem(
  accessToken: string,
  id: string,
  data: { name?: string; description?: string; priceRupees?: number; imageUrl?: string; isAvailable?: boolean; categoryId?: string },
) {
  return apiFetch<MenuItem>(`/menu/items/${id}`, { method: 'PATCH', accessToken, body: data });
}

export function deleteMenuItem(accessToken: string, id: string) {
  return apiFetch<void>(`/menu/items/${id}`, { method: 'DELETE', accessToken });
}

export { ApiError };
