import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Bike, Car, ChevronLeft, Images, Share2 } from "lucide-react-native";
import { useMemo } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import AppText from "@/components/AppText";
import FavoriteVehicleButton from "@/features/favorites/components/FavoriteVehicleButton";
import { detailFont, useDetailTheme } from "./detailTheme";

type Props = {
  photos: readonly string[];
  imageIndex: number;
  vehicleType: string;
  favoriteVehicleId: number;
  onBack: () => void;
  onShare: () => void;
  onIndexChange: (index: number) => void;
  onOpenPhoto: (index: number) => void;
};

export default function VehicleDetailHero({
  photos,
  imageIndex,
  vehicleType,
  favoriteVehicleId,
  onBack,
  onShare,
  onIndexChange,
  onOpenPhoto,
}: Props) {
  const { p } = useDetailTheme();
  const { width } = useWindowDimensions();
  const height = Math.min(width * 0.84, 430);
  const styles = useMemo(() => createStyles(height), [height]);
  const VehicleIcon = vehicleType === "Car" ? Car : Bike;

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    onIndexChange(Math.max(0, Math.min(next, photos.length - 1)));
  }

  return (
    <View style={styles.hero}>
      {photos.length > 0 ? (
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          scrollEnabled={photos.length > 1}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `${item}-${index}`}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={handleScrollEnd}
          initialNumToRender={1}
          windowSize={3}
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xem ảnh ${index + 1} trên ${photos.length} của xe`}
              onPress={() => onOpenPhoto(index)}
            >
              <Image
                accessibilityIgnoresInvertColors
                contentFit="cover"
                source={{ uri: item }}
                style={{ width, height }}
                cachePolicy="memory-disk"
                transition={180}
              />
            </Pressable>
          )}
        />
      ) : (
        <View style={[styles.empty, { width, height }]}>
          <VehicleIcon color="rgba(255,255,255,0.72)" size={44} />
          <AppText style={styles.emptyText}>Xe chưa có ảnh</AppText>
        </View>
      )}

      <LinearGradient
        colors={p.heroShade}
        locations={[0, 0.28, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.topbar, { paddingTop: 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          hitSlop={6}
          onPress={onBack}
          style={({ pressed }) => [styles.glassButton, pressed && styles.pressed]}
        >
          <ChevronLeft color="#FFFFFF" size={22} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chia sẻ xe"
            hitSlop={6}
            onPress={onShare}
            style={({ pressed }) => [styles.glassButton, pressed && styles.pressed]}
          >
            <Share2 color="#FFFFFF" size={18} strokeWidth={2.1} />
          </Pressable>
          <FavoriteVehicleButton
            disabled={false}
            overlay
            style={styles.glassButton}
            vehicleId={favoriteVehicleId}
          />
        </View>
      </View>

      {photos.length > 0 ? (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xem toàn bộ ${photos.length} ảnh`}
            onPress={() => onOpenPhoto(imageIndex)}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
          >
            <Images color="#FFFFFF" size={13} strokeWidth={2.1} />
            <AppText style={styles.pillText}>Xem {photos.length} ảnh</AppText>
          </Pressable>
          <View style={styles.pill}>
            <AppText style={styles.pillText}>
              {Math.min(imageIndex + 1, photos.length)} / {photos.length}
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (height: number) =>
  StyleSheet.create({
    hero: { height, backgroundColor: "#17121F", overflow: "hidden" },
    empty: { alignItems: "center", justifyContent: "center", gap: 8 },
    emptyText: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontFamily: detailFont.medium },
    topbar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    glassButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(16,12,28,0.34)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.26)",
    },
    pressed: { opacity: 0.72 },
    footer: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    pill: {
      minHeight: 30,
      paddingHorizontal: 11,
      borderRadius: 999,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(16,12,28,0.38)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)",
    },
    pillText: { color: "#FFFFFF", fontFamily: detailFont.semibold, fontSize: 11 },
  });
