import { AlertCircle, Sparkles } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { toApiError } from "@/features/auth/services/authService";
import { generateVehicleDescription } from "@/features/vehicles/services/vehicleService";
import type { VehicleDescriptionSuggestionRequest } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type Props = {
  value: string;
  onChange: (value: string) => void;
  request: VehicleDescriptionSuggestionRequest | null;
  onFocus?: (input: TextInput) => void;
  onBlur?: (input: TextInput) => void;
};

export default function VehicleDescriptionField({ value, onChange, request, onFocus, onBlur }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const inputRef = useRef<TextInput>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!request || generating) return;

    setGenerating(true);
    setError("");
    try {
      const result = await generateVehicleDescription({
        ...request,
        existingDescription: value.trim() || null,
      });
      const generatedDescription = result?.description?.trim();
      if (!generatedDescription) {
        setError("AI chưa tạo được mô tả. Vui lòng thử lại.");
        return;
      }
      onChange(generatedDescription);
    } catch (requestError) {
      const apiError = toApiError(requestError);
      setError(apiError.message || "Không thể tạo gợi ý lúc này. Vui lòng thử lại.");
    } finally {
      setGenerating(false);
    }
  }

  const buttonLabel = value.trim() ? "Viết lại bằng AI" : "Gợi ý bằng AI";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Mô tả thêm</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          accessibilityHint={!request ? "Chọn hãng, dòng xe, loại xe và năm sản xuất trước" : undefined}
          disabled={!request || generating}
          onPress={handleGenerate}
          style={({ pressed }) => [
            styles.generateButton,
            (!request || generating) && styles.generateButtonDisabled,
            pressed && request && !generating && styles.generateButtonPressed,
          ]}
        >
          {generating ? (
            <ActivityIndicator color={theme.brand} size="small" />
          ) : (
            <Sparkles color={request ? theme.brand : theme.faint} size={15} />
          )}
          <Text style={[styles.generateText, !request && styles.generateTextDisabled]}>
            {generating ? "Đang tạo..." : buttonLabel}
          </Text>
        </Pressable>
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          onChange(text);
          if (error) setError("");
        }}
        onFocus={() => {
          if (inputRef.current) onFocus?.(inputRef.current);
        }}
        onBlur={() => {
          if (inputRef.current) onBlur?.(inputRef.current);
        }}
        multiline
        maxLength={1500}
        numberOfLines={5}
        scrollEnabled
        placeholder="Mô tả về xe..."
        placeholderTextColor={theme.placeholder}
        style={styles.input}
        textAlignVertical="top"
      />

      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.errorRow}>
          <AlertCircle color={theme.danger} size={15} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { gap: 8, marginTop: 4 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    label: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    generateButton: {
      minHeight: 34,
      maxWidth: 170,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 11,
    },
    generateButtonDisabled: { borderColor: theme.border, backgroundColor: theme.surfaceAlt, opacity: 0.72 },
    generateButtonPressed: { opacity: 0.72 },
    generateText: { color: theme.brand, fontSize: 12, fontWeight: "800", flexShrink: 1 },
    generateTextDisabled: { color: theme.faint },
    input: {
      height: 128,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: theme.text,
      fontSize: 14,
      lineHeight: 21,
    },
    errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    errorText: { flex: 1, color: theme.danger, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  });
