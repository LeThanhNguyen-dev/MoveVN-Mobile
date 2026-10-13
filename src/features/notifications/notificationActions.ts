import { getAuthUser, getSessionGeneration, getToken } from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/services/apiClient";
import { getNotifications, getNotificationUnreadCount, markAllNotificationsAsRead, markNotificationAsRead } from "./services/notificationService";
import { sortNotifications, useNotificationStore } from "./useNotifications";

let listRequest = 0;
let countRequest = 0;

function captureSession() {
  const { userId, epoch } = useNotificationStore.getState();
  const generation = getSessionGeneration();
  return () => userId !== null && Boolean(getToken()) && getAuthUser()?.userId === userId
    && useNotificationStore.getState().userId === userId && useNotificationStore.getState().epoch === epoch
    && generation === getSessionGeneration();
}

export async function refreshNotificationCount() {
  const current = captureSession();
  if (!current()) return;
  const request = ++countRequest;
  const revision = useNotificationStore.getState().countRevision;
  try {
    const result = await getNotificationUnreadCount();
    if (current() && request === countRequest && revision === useNotificationStore.getState().countRevision) {
      useNotificationStore.getState().setUnreadCount(result.unreadCount);
    }
  } catch {
    if (current() && request === countRequest && revision === useNotificationStore.getState().countRevision) {
      useNotificationStore.setState({ countError: true });
    }
  }
}

export async function loadNotificationPage(options: { filter?: "all" | "unread"; more?: boolean } = {}) {
  const current = captureSession();
  if (!current()) return;
  const before = useNotificationStore.getState();
  const filter = options.filter ?? before.filter;
  const more = options.more === true;
  if (more && (before.loading || before.refreshing || before.loadingMore || before.page >= before.totalPages)) return;
  const request = ++listRequest;
  const page = more ? before.page + 1 : 1;
  const changedFilter = before.filter !== filter;
  const revision = before.revision;
  useNotificationStore.setState({
    filter, error: null, loading: !more && (changedFilter || before.items.length === 0),
    refreshing: !more && !changedFilter && before.items.length > 0, loadingMore: more,
    ...(changedFilter ? { items: [], page: 0, totalPages: 0, totalCount: 0 } : {}),
  });
  try {
    const result = await getNotifications({ page, pageSize: 20, unreadOnly: filter === "unread" ? true : undefined });
    if (!current() || request !== listRequest) return;
    const state = useNotificationStore.getState();
    const matches = (item: typeof state.items[number]) => filter === "all" || !item.isRead;
    const fetched = result.items.map((item) => {
      const update = state.updates[item.id]?.item;
      return update?.isRead && !item.isRead ? { ...item, isRead: true, readAt: update.readAt } : item;
    }).filter(matches);
    const receivedDuringRequest = Object.values(state.updates).filter((update) => update.revision > revision).map((update) => update.item).filter(matches);
    const items = sortNotifications([...(more ? state.items : []), ...fetched, ...receivedDuringRequest]);
    useNotificationStore.setState({ items, page: result.page, totalPages: result.totalPages, totalCount: Math.max(result.totalCount, items.length) });
    await refreshNotificationCount();
  } catch (error) {
    if (current() && request === listRequest) useNotificationStore.setState({ error: getApiErrorMessage(error, "Không thể tải thông báo. Vui lòng thử lại.") });
  } finally {
    if (current() && request === listRequest) useNotificationStore.setState({ loading: false, refreshing: false, loadingMore: false });
  }
}

export async function readNotification(id: number) {
  const current = captureSession();
  const state = useNotificationStore.getState();
  if (!current() || state.pendingIds.includes(id) || state.markingAll) return false;
  const known = state.items.find((item) => item.id === id) ?? state.updates[id]?.item;
  if (known?.isRead) return true;
  useNotificationStore.setState({ pendingIds: [...state.pendingIds, id] });
  try {
    const item = await markNotificationAsRead(id);
    if (!current()) return false;
    useNotificationStore.getState().applyRead(item);
    // Removing a row from an unread query shifts server page offsets. Reload
    // page one so the next page cannot skip the row that moved into its place.
    if (useNotificationStore.getState().filter === "unread") await loadNotificationPage();
    else await refreshNotificationCount();
    return true;
  } finally {
    if (current()) useNotificationStore.setState((latest) => ({ pendingIds: latest.pendingIds.filter((entry) => entry !== id) }));
  }
}

export async function readAllNotifications() {
  const current = captureSession();
  const state = useNotificationStore.getState();
  if (!current() || state.markingAll || state.pendingIds.length) return;
  const snapshot = state.items;
  useNotificationStore.setState({ markingAll: true });
  try {
    await markAllNotificationsAsRead();
    if (!current()) return;
    // Preserve notifications that arrived while the bulk request was in flight.
    snapshot.filter((item) => !item.isRead).forEach((item) => useNotificationStore.getState().applyRead({ ...item, isRead: true, readAt: new Date().toISOString() }));
    await loadNotificationPage();
    await refreshNotificationCount();
  } finally {
    if (current()) useNotificationStore.setState({ markingAll: false });
  }
}
