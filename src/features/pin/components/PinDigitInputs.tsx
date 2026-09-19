import { useEffect, useRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { PIN_DIGIT_COUNT } from "@/features/pin/services/pinErrorMessage";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type PinDigitInputsProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showValue?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
};

export default function PinDigitInputs({
  label,
  value,
  onChange,
  showValue = false,
  hasError = false,
  autoFocus = false,
  disabled = false,
}: PinDigitInputsProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const timer = setTimeout(() => inputRefs.current[0]?.focus(), 350);
    return () => clearTimeout(timer);
  }, [autoFocus, disabled]);

  function setChar(index: number, digit: string) {
    const chars = value.split("");
    chars[index] = digit;
    onChange(chars.join("").slice(0, PIN_DIGIT_COUNT));
  }

  function handleChange(index: number, text: string) {
    const digit = text.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    setChar(index, digit);
    if (index + 1 < PIN_DIGIT_COUNT) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleBackspace(index: number) {
    const chars = value.split("");
    chars[index] = "";
    onChange(chars.join(""));
    if (index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {Array.from({ length: PIN_DIGIT_COUNT }).map((_, index) => (
          <TextInput
            key={index}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
            accessibilityLabel={`${label} ô ${index + 1}`}
            autoComplete="one-time-code"
            editable={!disabled}
            keyboardType="number-pad"
            maxLength={1}
            onChangeText={(text) => handleChange(index, text)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === "Backspace") handleBackspace(index);
            }}
            secureTextEntry={!showValue}
            selectTextOnFocus
            style={[styles.box, hasError && styles.boxError]}
            value={value[index] ?? ""}
          />
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    block: { gap: 8 },
    label: { color: theme.muted, fontSize: 13, fontWeight: "700", textAlign: "center" },
    row: { flexDirection: "row", justifyContent: "center", gap: 8 },
    box: {
      width: 44,
      height: 52,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.input,
      color: theme.text,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    boxError: { borderColor: theme.danger },
  });
