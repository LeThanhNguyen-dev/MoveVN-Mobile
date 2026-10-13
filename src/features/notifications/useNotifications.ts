import { create } from "zustand";
import type { NotificationItem } from "./types";

type NotificationState = {
  userId: number | null;
  epoch: number;
  items: NotificationItem[];
  unreadCount: number;
  countRevision: number;
  revision: number;
  updates: Record<number, { item: NotificationItem; revision: number }>;
  filter: "all" | "unread";
  page: number;
  totalPages: number;
  totalCount: number;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  countError: boolean;
  pendingIds: number[];
  markingAll: boolean;
  centerOpen: boolean;
  connectionStatus: "connecting" | "connected" | "offline";
  activate: (userId: number | null) => void;
  setUnreadCount: (count: number) => void;
  prependNotification: (item: NotificationItem, count: number) => void;
  applyRead: (item: NotificationItem) => void;
  reset: () => void;
};

const empty = {
  userId: null, items: [] as NotificationItem[], unreadCount: 0, countRevision: 0,
  revision: 0, updates: {}, filter: "all" as const, page: 0, totalPages: 0, totalCount: 0,
  loading: false, refreshing: false, loadingMore: false, error: null, countError: false,
  pendingIds: [] as number[], markingAll: false, centerOpen: false, connectionStatus: "offline" as const,
};

export function sortNotifications(items: NotificationItem[]) {
  const unique = new Map<number, NotificationItem>();
  for (const item of items) {
    const previous = unique.get(item.id);
    unique.set(item.id, previous?.isRead && !item.isRead ? { ...item, isRead: true, readAt: previous.readAt } : item);
  }
  return [...unique.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.id - a.id);
}

export const useNotificationStore = create<NotificationState>((set) => ({
  ...empty, epoch: 0,
  activate: (userId) => set((state) => state.userId === userId ? state : ({ ...empty, userId, epoch: state.epoch + 1 })),
  setUnreadCount: (unreadCount) => set((state) => ({ unreadCount: Math.max(0, unreadCount), countRevision: state.countRevision + 1, countError: false })),
  prependNotification: (item, unreadCount) => set((state) => {
    if (state.userId === null || !["InApp", "Both"].includes(item.channel)) return state;
    const revision = state.revision + 1;
    const updated = state.updates[item.id]?.item;
    const loaded = state.items.find((entry) => entry.id === item.id);
    const previous = loaded?.isRead ? loaded : updated ?? loaded;
    if (previous?.isRead && !item.isRead) item = { ...item, isRead: true, readAt: previous.readAt };
    const known = state.items.some((entry) => entry.id === item.id) || Boolean(state.updates[item.id]);
    const visible = state.filter === "all" || !item.isRead;
    return {
      revision, updates: { ...state.updates, [item.id]: { item, revision } },
      items: sortNotifications([...state.items.filter((entry) => entry.id !== item.id), ...(visible ? [item] : [])]),
      totalCount: state.totalCount + (!known && visible ? 1 : 0),
      unreadCount: Math.max(0, unreadCount), countRevision: state.countRevision + 1, countError: false,
    };
  }),
  // SignalR may deliver the new count before the mark-read HTTP response.
  // Apply the item separately, without decrementing that count a second time.
  applyRead: (item) => set((state) => {
    const revision = state.revision + 1;
    const removed = state.filter === "unread" && state.items.some((entry) => entry.id === item.id);
    return {
      revision, updates: { ...state.updates, [item.id]: { item, revision } },
      items: state.items.map((entry) => entry.id === item.id ? item : entry).filter((entry) => state.filter === "all" || !entry.isRead),
      totalCount: Math.max(0, state.totalCount - (removed ? 1 : 0)),
    };
  }),
  reset: () => set((state) => ({ ...empty, epoch: state.epoch + 1 })),
}));
