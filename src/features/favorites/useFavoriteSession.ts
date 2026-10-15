import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { refreshFavoriteIds } from "./favoriteActions";
import { useFavoriteStore } from "./useFavorites";

export function useFavoriteSession() {
  const userId = useAuthStore((state) =>
    state.token?.accessToken &&
    state.activeRole === "Customer" &&
    state.user?.roles.includes("Customer")
      ? state.user.userId
      : null,
  );
  useEffect(() => {
    useFavoriteStore.getState().activate(userId);
    if (userId == null) return;
    void refreshFavoriteIds();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshFavoriteIds();
    });
    return () => {
      listener.remove();
      useFavoriteStore.getState().activate(null);
    };
  }, [userId]);
}

export function useRefreshFavoritesOnFocus() {
  useFocusEffect(
    useCallback(() => {
      void refreshFavoriteIds();
    }, []),
  );
}
