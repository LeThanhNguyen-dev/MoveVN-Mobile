import { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Heart, RefreshCw } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";
import VehicleListCard from "@/features/vehicles/components/VehicleListCard";
import { loadFavoriteVehicles, refreshFavoriteIds } from "../favoriteActions";
import { useFavoriteStore } from "../useFavorites";

export default function FavoriteVehiclesScreen({
  onBack,
  onOpen,
  onExplore,
}: {
  onBack: () => void;
  onOpen: (vehicleId: number) => void;
  onExplore: () => void;
}) {
  const state = useFavoriteStore();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  useFocusEffect(
    useCallback(() => {
      void refreshFavoriteIds();
      void loadFavoriteVehicles();
      const back = BackHandler.addEventListener("hardwareBackPress", () => {
        onBack();
        return true;
      });
      return () => back.remove();
    }, [onBack]),
  );
  useEffect(() => {
    if (
      state.listDirty &&
      !state.listError &&
      !state.loading &&
      !state.refreshing &&
      !state.loadingMore &&
      !state.pendingIds.length
    )
      void loadFavoriteVehicles();
  }, [
    state.listDirty,
    state.listError,
    state.loading,
    state.refreshing,
    state.loadingMore,
    state.pendingIds.length,
  ]);
  const refresh = () => {
    void refreshFavoriteIds();
    void loadFavoriteVehicles();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại từ xe yêu thích"
          onPress={onBack}
          style={styles.icon}
        >
          <ArrowLeft color={theme.text} size={23} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.title}>Xe yêu thích</Text>
          <Text style={styles.subtitle}>
            {state.listLoaded
              ? `${state.totalCount} xe đang hiển thị`
              : "Những chiếc xe bạn muốn thuê"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Làm mới xe yêu thích"
          disabled={state.loading || state.refreshing || state.loadingMore}
          onPress={refresh}
          style={styles.icon}
        >
          <RefreshCw color={theme.brand} size={21} />
        </Pressable>
      </View>
      {state.idsError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thử tải lại trạng thái yêu thích"
          onPress={() => {
            void refreshFavoriteIds();
          }}
        >
          <Text style={styles.error}>{state.idsError}</Text>
        </Pressable>
      ) : null}
      {state.listError ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.error}>
            {state.listError}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thử tải lại xe yêu thích"
            onPress={() => {
              void loadFavoriteVehicles(
                state.page > 0 && state.page < state.totalPages,
              );
            }}
            style={styles.retry}
          >
            <Text style={styles.link}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}
      {state.items.length ? (
        <Text style={styles.hint}>
          Giá tham khảo. Mở chi tiết để chọn thời gian và kiểm tra lịch xe.
        </Text>
      ) : null}
      <FlatList
        data={state.items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={refresh}
            tintColor={theme.brand}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item }) => (
          <VehicleListCard vehicle={item} onOpen={onOpen} onBook={onOpen} />
        )}
        ListEmptyComponent={
          state.loading || (!state.listLoaded && !state.listError) ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={theme.brand} />
              <Text style={styles.subtitle}>Đang tải xe yêu thích…</Text>
            </View>
          ) : state.listError ? null : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Heart size={34} color={theme.brand} />
              </View>
              <Text style={styles.emptyTitle}>Chưa có xe yêu thích</Text>
              <Text style={styles.emptyText}>
                Nhấn biểu tượng trái tim trên một chiếc xe để lưu tại đây. Danh
                sách hiển thị các xe đã được duyệt và còn công khai.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Khám phá xe để yêu thích"
                onPress={onExplore}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Khám phá xe</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          state.page > 0 && state.page < state.totalPages ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem thêm xe yêu thích"
              disabled={state.loadingMore || state.refreshing}
              onPress={() => {
                void loadFavoriteVehicles(true);
              }}
              style={styles.more}
            >
              {state.loadingMore ? (
                <ActivityIndicator color={theme.brand} />
              ) : (
                <Text style={styles.link}>Xem thêm xe</Text>
              )}
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    icon: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    heading: { flex: 1 },
    title: { color: theme.text, fontSize: 22, fontWeight: "800" },
    subtitle: { color: theme.muted, fontSize: 12, marginTop: 5 },
    list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
    hint: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 18,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    errorBox: {
      backgroundColor: theme.dangerSoft,
      margin: 12,
      borderRadius: 12,
    },
    error: { color: theme.danger, padding: 12, fontSize: 13 },
    retry: { alignSelf: "flex-start", padding: 12 },
    link: { color: theme.brand, fontSize: 14, fontWeight: "700" },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
      paddingHorizontal: 24,
      gap: 12,
    },
    emptyIcon: {
      padding: 20,
      borderRadius: 40,
      backgroundColor: theme.brandSoft,
    },
    emptyTitle: { fontSize: 19, fontWeight: "800", color: theme.text },
    emptyText: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.muted,
      textAlign: "center",
    },
    primary: {
      backgroundColor: theme.brand,
      padding: 14,
      paddingHorizontal: 24,
      borderRadius: 14,
      marginTop: 8,
    },
    primaryText: { color: theme.onBrand, fontWeight: "700" },
    more: { padding: 18, alignItems: "center" },
  });
