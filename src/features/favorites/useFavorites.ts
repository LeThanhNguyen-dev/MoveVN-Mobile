import { create } from "zustand";
import type { VehicleListItemResponse } from "@/features/vehicles/types";

interface FavoriteState {
  userId: number | null;
  epoch: number;
  open: boolean;
  ids: number[];
  idsLoaded: boolean;
  idsLoading: boolean;
  idsError: string | null;
  pendingIds: number[];
  items: VehicleListItemResponse[];
  page: number;
  totalPages: number;
  totalCount: number;
  listLoaded: boolean;
  listDirty: boolean;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  listError: string | null;
  revision: number;
  changes: Record<number, { saved: boolean; revision: number }>;
  activate: (userId: number | null) => void;
}

const initial = () => ({
  userId: null,
  open: false,
  ids: [],
  idsLoaded: false,
  idsLoading: false,
  idsError: null,
  pendingIds: [],
  items: [],
  page: 0,
  totalPages: 0,
  totalCount: 0,
  listLoaded: false,
  listDirty: false,
  loading: false,
  refreshing: false,
  loadingMore: false,
  listError: null,
  revision: 0,
  changes: {},
});

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  ...initial(),
  epoch: 0,
  activate: (userId) => {
    if (get().userId !== userId)
      set({ ...initial(), userId, epoch: get().epoch + 1 });
  },
}));
