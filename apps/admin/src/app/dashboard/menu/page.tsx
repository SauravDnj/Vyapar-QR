'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  listMenuCategories,
  updateMenuItem,
  type MenuCategory,
} from '../../../lib/menu-api';

function AddItemForm({ categoryId, onAdded }: { categoryId: string; onAdded: () => void }) {
  const { accessToken } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  async function handleAdd() {
    if (!accessToken || !name.trim() || !price) return;
    setIsCreating(true);
    try {
      await createMenuItem(accessToken, categoryId, {
        name: name.trim(),
        description: description.trim() || undefined,
        priceRupees: Number(price),
      });
      setName('');
      setDescription('');
      setPrice('');
      onAdded();
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border-color p-2">
      <label className="flex flex-1 flex-col gap-1 text-xs">
        Item name
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-border-color px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-xs">
        Description (optional)
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="rounded border border-border-color px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Price (₹)
        <input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-24 rounded border border-border-color px-2 py-1 text-sm"
        />
      </label>
      <button
        disabled={isCreating || !name.trim() || !price}
        onClick={() => void handleAdd()}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
      >
        {isCreating ? 'Adding…' : 'Add item'}
      </button>
    </div>
  );
}

function MenuContent() {
  const { accessToken } = useAuth();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLocked(false);
    try {
      setCategories(await listMenuCategories(accessToken));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setLocked(true);
      } else {
        setMessage('Failed to load menu.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleCreateCategory() {
    if (!accessToken || !newCategoryName.trim()) return;
    setIsCreatingCategory(true);
    try {
      await createMenuCategory(accessToken, { name: newCategoryName.trim() });
      setNewCategoryName('');
      await refresh();
    } catch {
      setMessage('Failed to create category.');
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!accessToken) return;
    try {
      await deleteMenuCategory(accessToken, id);
      await refresh();
    } catch {
      setMessage('Failed to delete category.');
    }
  }

  async function handleToggleAvailable(itemId: string, isAvailable: boolean) {
    if (!accessToken) return;
    try {
      await updateMenuItem(accessToken, itemId, { isAvailable });
      await refresh();
    } catch {
      setMessage('Failed to update item.');
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!accessToken) return;
    try {
      await deleteMenuItem(accessToken, itemId);
      await refresh();
    } catch {
      setMessage('Failed to delete item.');
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Menu</h1>
      <p className="text-sm text-muted">Manage your orderable menu — customers browse it on your page and order via WhatsApp.</p>
      {message && <p className="text-sm text-danger">{message}</p>}

      {locked ? (
        <div className="w-fit max-w-md rounded-md border border-warning bg-warning-bg p-4 text-sm text-warning">
          <p className="font-medium">Digital menu + ordering is a plan feature.</p>
          <p className="mt-1">
            Upgrade your plan from{' '}
            <a href="/dashboard/billing" className="underline">
              Billing
            </a>{' '}
            to let customers browse your menu and order.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2 rounded-lg border border-dashed border-border-color p-4">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              New category
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Starters"
                className="rounded-md border border-border-color px-3 py-2 text-sm"
              />
            </label>
            <button
              disabled={isCreatingCategory || !newCategoryName.trim()}
              onClick={() => void handleCreateCategory()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {isCreatingCategory ? 'Adding…' : 'Add category'}
            </button>
          </div>

          {categories.length === 0 ? (
            <p className="text-sm text-muted">No categories yet — add one above to start building your menu.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {categories.map((category) => (
                <div key={category.id} className="flex flex-col gap-2 rounded-lg border border-border-color bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{category.name}</p>
                    <button onClick={() => void handleDeleteCategory(category.id)} className="text-xs text-danger underline">
                      Delete category
                    </button>
                  </div>

                  {category.items.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {category.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border-color px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium">
                              {item.name} — ₹{item.priceRupees}
                            </p>
                            {item.description && <p className="text-xs text-muted">{item.description}</p>}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => void handleToggleAvailable(item.id, !item.isAvailable)}
                              className="rounded-md border border-border-color px-3 py-1 text-xs"
                            >
                              {item.isAvailable ? 'Mark unavailable' : 'Mark available'}
                            </button>
                            <button onClick={() => void handleDeleteItem(item.id)} className="rounded-md border border-border-color px-3 py-1 text-xs">
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <AddItemForm categoryId={category.id} onAdded={() => void refresh()} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function MenuPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <MenuContent />
    </ProtectedRoute>
  );
}
