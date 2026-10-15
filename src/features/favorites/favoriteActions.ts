import {
  getAuthUser,
  getSessionGeneration,
  getToken,
  useAuthStore,
} from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/services/apiClient";
import {
  addFavoriteVehicle,
  getFavoriteVehicleIds,
  getFavoriteVehicles,
  removeFavoriteVehicle,
} from "@/features/vehicles/services/favoriteVehicleService";
import { useFavoriteStore as store } from "./useFavorites";

let idsPending: { key: string; promise: Promise<void> } | null = null;
let listRequest = 0;

export function isFavoriteCustomer() {
  return Boolean(
    getToken() &&
      getAuthUser()?.roles.includes("Customer") &&
      useAuthStore.getState().activeRole === "Customer",
  );
}

export function captureFavoriteSession() {
  const { userId, epoch } = store.getState();
  const generation = getSessionGeneration();
  return () =>
    userId !== null &&
    isFavoriteCustomer() &&
    getAuthUser()?.userId === userId &&
    store.getState().userId === userId &&
    store.getState().epoch === epoch &&
    generation === getSessionGeneration();
}

export function openFavoriteVehicles() {
  if (captureFavoriteSession()()) store.setState({ open: true });
}

export function refreshFavoriteIds(): Promise<void> {
  const current = captureFavoriteSession();
  if (!current()) return Promise.resolve();
  const key = `${store.getState().epoch}:${getSessionGeneration()}`;
  if (idsPending?.key === key) return idsPending.promise;
  const revision = store.getState().revision;
  store.setState({ idsLoading: true, idsError: null });
  const promise = (async () => {
    try {
      const ids = new Set(await getFavoriteVehicleIds());
      if (!current()) return;
      for (const [id, change] of Object.entries(store.getState().changes)) {
        if (change.revision <= revision) continue;
        if (change.saved) ids.add(Number(id));
        else ids.delete(Number(id));
      }
      store.setState({ ids: [...ids], idsLoaded: true });
    } catch (error) {
      if (current())
        store.setState({
          idsError: getApiErrorMessage(
            error,
            "Chưa tải được trạng thái yêu thích. Nhấn để thử lại.",
          ),
        });
    } finally {
      if (current()) store.setState({ idsLoading: false });
    }
  })().finally(() => {
    if (idsPending?.promise === promise) idsPending = null;
  });
  idsPending = { key, promise };
  return promise;
}

export async function loadFavoriteVehicles(more = false) {
  const current = captureFavoriteSession();
  const state = store.getState();
  if (!current() || state.loading || state.refreshing || state.loadingMore)
    return;
  // Deleting a row shifts offset-based pages. Restart from page one before
  // loading another page so a saved vehicle cannot be skipped.
  more = more && !state.listDirty;
  if (more && state.page >= state.totalPages) return;
  const request = ++listRequest;
  const revision = state.revision;
  const page = more ? state.page + 1 : 1;
  store.setState({
    loading: !more && !state.listLoaded,
    refreshing: !more && state.listLoaded,
    loadingMore: more,
    listError: null,
    listDirty: false,
  });
  try {
    const result = await getFavoriteVehicles(page, 12);
    if (!current() || request !== listRequest) return;
    if (store.getState().revision !== revision) {
      store.setState({ listDirty: true });
      return;
    }
    const items = [
      ...new Map(
        [...(more ? store.getState().items : []), ...result.items].map(
          (item) => [item.id, item],
        ),
      ).values(),
    ];
    store.setState({
      items,
      page: result.page,
      totalPages: result.totalPages,
      totalCount: result.totalCount,
      listLoaded: true,
    });
  } catch (error) {
    if (current() && request === listRequest)
      store.setState({
        listError: getApiErrorMessage(
          error,
          "Không tải được xe yêu thích. Vui lòng thử lại.",
        ),
        listDirty: state.listDirty || store.getState().revision !== revision,
      });
  } finally {
    if (current() && request === listRequest)
      store.setState({ loading: false, refreshing: false, loadingMore: false });
  }
}

export async function toggleFavoriteVehicle(
  vehicleId: number,
): Promise<{ ok: boolean; error?: string }> {
  const current = captureFavoriteSession();
  const state = store.getState();
  if (
    !current() ||
    !Number.isSafeInteger(vehicleId) ||
    vehicleId <= 0 ||
    state.pendingIds.includes(vehicleId)
  )
    return { ok: false };
  if (!state.idsLoaded) {
    await refreshFavoriteIds();
    // Let the user confirm the intended save/remove action once its state is known.
    return {
      ok: false,
      ...(current() && !store.getState().idsLoaded
        ? {
            error:
              store.getState().idsError ??
              "Chưa tải được trạng thái yêu thích.",
          }
        : {}),
    };
  }
  const saved = state.ids.includes(vehicleId);
  store.setState({ pendingIds: [...state.pendingIds, vehicleId] });
  try {
    if (saved) await removeFavoriteVehicle(vehicleId);
    else await addFavoriteVehicle(vehicleId);
    if (!current()) return { ok: false };
    store.setState((latest) => {
      const revision = latest.revision + 1;
      return {
        ids: saved
          ? latest.ids.filter((id) => id !== vehicleId)
          : [...new Set([...latest.ids, vehicleId])],
        items: saved
          ? latest.items.filter((item) => item.id !== vehicleId)
          : latest.items,
        totalCount: latest.listLoaded
          ? Math.max(0, latest.totalCount + (saved ? -1 : 1))
          : latest.totalCount,
        revision,
        changes: {
          ...latest.changes,
          [vehicleId]: { saved: !saved, revision },
        },
        listDirty: true,
      };
    });
    return { ok: true };
  } catch (error) {
    if (!current()) return { ok: false };
    return {
      ok: false,
      error: getApiErrorMessage(
        error,
        saved
          ? "Chưa bỏ được xe khỏi yêu thích. Vui lòng thử lại."
          : "Chưa lưu được xe. Kiểm tra kết nối và tình trạng xe rồi thử lại.",
      ),
    };
  } finally {
    if (current())
      store.setState((latest) => ({
        pendingIds: latest.pendingIds.filter((id) => id !== vehicleId),
      }));
  }
}
