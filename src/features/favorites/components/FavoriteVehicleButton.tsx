import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Heart, RefreshCw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import {
  captureFavoriteSession,
  refreshFavoriteIds,
  toggleFavoriteVehicle,
} from "../favoriteActions";
import { useFavoriteStore } from "../useFavorites";

export default function FavoriteVehicleButton({
  vehicleId,
  disabled = false,
  overlay = false,
  style,
}: {
  vehicleId: number;
  disabled?: boolean;
  overlay?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const supported = useAuthStore(
    (auth) =>
      auth.activeRole === "Customer" &&
      Boolean(auth.user?.roles.includes("Customer")),
  );
  const userId = useAuthStore((auth) => auth.user?.userId);
  const saved = useFavoriteStore(
    (state) => state.userId === userId && state.ids.includes(vehicleId),
  );
  const loaded = useFavoriteStore(
    (state) => state.userId === userId && state.idsLoaded,
  );
  const loading = useFavoriteStore((state) => state.idsLoading);
  const pending = useFavoriteStore((state) =>
    state.pendingIds.includes(vehicleId),
  );
  const { t } = useTranslation();
  const { theme } = useTheme();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (!supported) return null;
  const label = !loaded
    ? t("mobile:favorites.loadStateAria", { id: vehicleId })
    : saved
      ? t("common:unfavoriteVehicle", { title: vehicleId })
      : t("mobile:favorites.saveAria", { id: vehicleId });
  const busy = pending || (!loaded && loading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: saved, disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      hitSlop={6}
      style={[styles.button, style]}
      onPress={async (event) => {
        event.stopPropagation();
        const current = captureFavoriteSession();
        if (!loaded) {
          await refreshFavoriteIds();
          if (
            current() &&
            mounted.current &&
            !useFavoriteStore.getState().idsLoaded
          )
            Alert.alert(
              t("mobile:favorites.alertTitle"),
              useFavoriteStore.getState().idsError ?? t("mobile:favorites.alertMessage"),
            );
          return;
        }
        const result = await toggleFavoriteVehicle(vehicleId);
        if (result.error && current() && mounted.current)
          Alert.alert(t("mobile:favorites.errorTitle"), result.error);
      }}
    >
      {busy ? (
        <ActivityIndicator
          color={overlay ? theme.onBrand : theme.brand}
          size="small"
        />
      ) : !loaded ? (
        <RefreshCw size={20} color={overlay ? theme.onBrand : theme.brand} />
      ) : (
        <Heart
          size={21}
          color={saved ? theme.danger : overlay ? theme.onBrand : theme.text}
          fill={saved ? theme.danger : "transparent"}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
