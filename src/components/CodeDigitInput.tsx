import type { ComponentRef } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export type CodeDigitInputHandle = {
  focusFirst: () => void;
};

type CodeDigitInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label?: string;
  onComplete?: (code: string) => void;
  secure?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  ariaLabelFor?: (index: number) => string;
  autoComplete?: "one-time-code" | "off";
};

/** Ô vuông nhập mã PIN/OTP, tự chia khi paste hoặc autofill SMS. */
const CodeDigitInput = forwardRef<CodeDigitInputHandle, CodeDigitInputProps>(function CodeDigitInput(
  {
    value,
    onChange,
    length = 6,
    label,
    onComplete,
    secure = false,
    hasError = false,
    autoFocus = false,
    disabled = false,
    ariaLabelFor,
    autoComplete = "one-time-code",
  },
  ref,
) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const inputRefs = useRef<Array<ComponentRef<typeof TextInput> | null>>([]);

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

  function apply(nextValue: string) {
    const next = nextValue.slice(0, length);
    onChange(next);
    return next;
  }

  function setChar(index: number, digit: string) {
    const chars = value.split("");
    chars[index] = digit;
    const next = apply(chars.join(""));
    if (next.length === length) {
      onComplete?.(next);
    } else if (index + 1 < length) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleChange(index: number, text: string) {
    // Không maxLength để paste/autofill nhiều số tự chia đều ra các ô.
    const digits = text.replace(/\D/g, "");
    if (!digits) return;
    if (digits.length === 1) {
      setChar(index, digits);
      return;
    }
    const chars = value.split("");
    for (let offset = 0; offset < digits.length && index + offset < length; offset += 1) {
      const digit = digits[offset];
      if (digit !== undefined) chars[index + offset] = digit;
    }
    const next = apply(chars.join(""));
    if (next.length === length) {
      onComplete?.(next);
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
      {label ? <AppText style={styles.label}>{label}</AppText> : null}
      <View style={styles.row}>
        {Array.from({ length }).map((_, index) => (
          <TextInput
            key={index}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
            accessibilityLabel={ariaLabelFor?.(index)}
            autoComplete={autoComplete}
            editable={!disabled}
            keyboardType="number-pad"
            onChangeText={(text) => handleChange(index, text)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === "Backspace") handleBackspace(index);
            }}
            secureTextEntry={secure}
            selectTextOnFocus
            style={[styles.box, hasError && styles.boxError]}
            value={value[index] ?? ""}
          />
        ))}
      </View>
    </View>
  );
});

export default CodeDigitInput;

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
