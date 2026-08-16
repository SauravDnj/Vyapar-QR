'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/auth-context';
import { listNotifications, type NotificationItem } from '../lib/notifications-api';

const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    async function refresh() {
      const result = await listNotifications(accessToken!);
      if (!cancelled) {
        setItems(result);
      }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        aria-label="Notifications"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-md border border-border-color px-2 py-1.5 text-sm"
      >
        🔔
        {items.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-accent-foreground">
            {items.length > 9 ? '9+' : items.length}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-lg border border-border-color bg-surface p-2 text-sm shadow-card"
        >
          <p className="px-2 py-1 font-medium">Recent activity</p>
          {items.length === 0 ? (
            <p className="px-2 py-2 text-muted">Nothing new in the last two weeks.</p>
          ) : (
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={item.link}
                  onClick={() => setIsOpen(false)}
                  className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-border-color/40"
                >
                  <span>{item.message}</span>
                  <span className="text-xs text-muted">{new Date(item.createdAt).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
