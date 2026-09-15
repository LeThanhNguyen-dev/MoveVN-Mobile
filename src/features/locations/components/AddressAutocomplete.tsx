import { MapPin, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { GoongPlacePrediction } from "@/features/locations/types";
import {
  autocompleteGoongPlaces,
  getGoongPlaceDetail,
} from "@/features/locations/services/locationService";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export type SelectedAddress = {
  address: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: SelectedAddress) => void;
  onManualChange?: () => void;
  label?: string;
  placeholder?: string;
  showLabel?: boolean;
};

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onManualChange,
  label = "Địa chỉ chi tiết",
  placeholder = "Số nhà, đường...",
  showLabel = true,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [predictions, setPredictions] = useState<GoongPlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(text: string) {
    onChange(text);
    onManualChange?.();
    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) {
      setPredictions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      autocompleteGoongPlaces(text.trim(), 5)
        .then((list) => setPredictions(list))
        .catch(() => setPredictions([]))
        .finally(() => setLoading(false));
    }, 350);
  }

  async function handleSelect(item: GoongPlacePrediction) {
    setPredictions([]);
    setSelecting(true);
    setError("");
    try {
      const detail = await getGoongPlaceDetail(item.placeId);
      const address = detail?.formattedAddress || item.description;
      onChange(address);
      onSelect({
        address,
        latitude: detail?.latitude ?? null,
        longitude: detail?.longitude ?? null,
        placeId: detail?.placeId || item.placeId,
      });
    } catch {
      // Không lấy được tọa độ thì vẫn giữ địa chỉ text đã chọn.
      onChange(item.description);
      onSelect({ address: item.description, latitude: null, longitude: null, placeId: item.placeId });
      setError("Không lấy được tọa độ địa chỉ.");
    } finally {
      setSelecting(false);
    }
  }

  function handleClear() {
    onChange("");
    onManualChange?.();
    setPredictions([]);
    setError("");
  }

  const busy = loading || selecting;

  return (
    <View style={styles.wrap}>
      {showLabel ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.searchBox}>
        <MapPin color={theme.placeholder} size={15} />
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={theme.placeholder}
          style={styles.searchInput}
        />
        {busy ? (
          <ActivityIndicator color={theme.brand} size="small" />
        ) : value ? (
          <Pressable onPress={handleClear} accessibilityLabel="Xóa địa chỉ">
            <X color={theme.muted} size={15} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {predictions.length > 0 ? (
        <View style={styles.placeList}>
          {predictions.map((p) => (
            <Pressable key={p.placeId} onPress={() => void handleSelect(p)} style={styles.placeItem}>
              <MapPin color={theme.brand} size={15} />
              <View style={styles.placeText}>
                <Text numberOfLines={1} style={styles.placeMain}>
                  {p.structuredFormatting?.mainText || p.description}
                </Text>
                <Text numberOfLines={1} style={styles.placeSub}>
                  {p.structuredFormatting?.secondaryText || ""}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    label: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: { flex: 1, color: theme.text, fontSize: 13, height: "100%" },
    errorText: { color: theme.danger, fontSize: 12, fontWeight: "600" },
    placeList: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    placeItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
    placeText: { flex: 1, gap: 1 },
    placeMain: { color: theme.text, fontSize: 13, fontWeight: "700" },
    placeSub: { color: theme.muted, fontSize: 11, marginTop: 1 },
  });
