import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { PIN_DIGIT_COUNT } from "@/features/pin/services/pinErrorMessage";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export type PinDigitInputsHandle = {
  focusFirst: () => void;
};

type PinDigitInputsProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: () => void;
  showValue?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
};

const PinDigitInputs = forwardRef<PinDigitInputsHandle, PinDigitInputsProps>(function PinDigitInputs(
  {
    label,
    value,
    onChange,
    onComplete,
    showValue = false,
    hasError = false,
    autoFocus = false,
    disabled = false,
  },
  ref,
) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const timer = setTimeout(() => inputRefs.current[0]?.focus(), 350);
    return () => clearTimeout(timer);
  }, [autoFocus, disabled]);

  useImperativeHandle(
    ref,
    () => ({
      focusFirst: () => inputRefs.current[0]?.focus(),
    }),
    [],
  );

  function setChar(index: number, digit: string) {
    const chars = value.split("");
    chars[index] = digit;
    const next = chars.join("").slice(0, PIN_DIGIT_COUNT);
    onChange(next);
    if (next.length === PIN_DIGIT_COUNT) {
      onComplete?.();
    } else if (index + 1 < PIN_DIGIT_COUNT) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleChange(index: number, text: string) {
    // Không maxLength để paste/autofill SMS nhiều số tự chia đều ra các ô.
    const digits = text.replace(/\D/g, "");
    if (!digits) return;
    if (digits.length === 1) {
      setChar(index, digits);
      return;
    }
    const chars = value.split("");
    for (let offset = 0; offset < digits.length && index + offset < PIN_DIGIT_COUNT; offset += 1) {
      const digit = digits[offset];
      if (digit !== undefined) chars[index + offset] = digit;
    }
    const next = chars.join("").slice(0, PIN_DIGIT_COUNT);
    onChange(next);
    if (next.length === PIN_DIGIT_COUNT) {
      onComplete?.();
    } else {
      inputRefs.current[next.length]?.focus();
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
});

export default PinDigitInputs;

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
