import { MapPin, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native"
import AppText from "@/components/AppText";
import { useTranslation } from "react-i18next";
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
  onFocusInput?: () => void;
  label?: string;
  placeholder?: string;
  showLabel?: boolean;
};

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onManualChange,
  onFocusInput,
  label,
  placeholder,
  showLabel = true,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const labelText = label ?? t("common:addressLabel");
  const placeholderText = placeholder ?? t("mobile:vehicleList.address.placeholder");
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [predictions, setPredictions] = useState<GoongPlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionSequence = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(text: string) {
    selectionSequence.current++;
    setSelecting(false);
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
    const sequence = ++selectionSequence.current;
    onManualChange?.();
    setPredictions([]);
    setSelecting(true);
    setError("");
    try {
      const detail = await getGoongPlaceDetail(item.placeId);
      if (sequence !== selectionSequence.current) return;
      const address = detail?.formattedAddress || item.description;
      onChange(address);
      onSelect({
        address,
        latitude: detail?.latitude ?? null,
        longitude: detail?.longitude ?? null,
        placeId: detail?.placeId || item.placeId,
      });
    } catch {
      if (sequence !== selectionSequence.current) return;
      // Không lấy được tọa độ thì vẫn giữ địa chỉ text đã chọn.
      onChange(item.description);
      onSelect({ address: item.description, latitude: null, longitude: null, placeId: item.placeId });
      setError(t("common:addressCoordsError"));
    } finally {
      if (sequence === selectionSequence.current) setSelecting(false);
    }
  }

  function handleClear() {
    selectionSequence.current++;
    setSelecting(false);
    onChange("");
    onManualChange?.();
    setPredictions([]);
    setError("");
  }

  const busy = loading || selecting;

  return (
    <View style={styles.wrap}>
      {showLabel ? <AppText style={styles.label}>{labelText}</AppText> : null}
      <View style={styles.searchBox}>
        <MapPin color={theme.placeholder} size={15} />
        <TextInput
          value={value}
          onChangeText={handleChange}
          onFocus={onFocusInput}
          placeholder={placeholderText}
          placeholderTextColor={theme.placeholder}
          style={styles.searchInput}
        />
        {busy ? (
          <ActivityIndicator color={theme.brand} size="small" />
        ) : value ? (
          <Pressable onPress={handleClear} accessibilityLabel={t("mobile:vehicleList.address.clearAria")}>
            <X color={theme.muted} size={15} />
          </Pressable>
        ) : null}
      </View>
      {error ? <AppText style={styles.errorText}>{error}</AppText> : null}
      {predictions.length > 0 ? (
        <View style={styles.placeList}>
          {predictions.map((p) => (
            <Pressable key={p.placeId} onPress={() => void handleSelect(p)} style={styles.placeItem}>
              <MapPin color={theme.brand} size={15} />
              <View style={styles.placeText}>
                <AppText numberOfLines={1} style={styles.placeMain}>
                  {p.structuredFormatting?.mainText || p.description}
                </AppText>
                <AppText numberOfLines={1} style={styles.placeSub}>
                  {p.structuredFormatting?.secondaryText || ""}
                </AppText>
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
