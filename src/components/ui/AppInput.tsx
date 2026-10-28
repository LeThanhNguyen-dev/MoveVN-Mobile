import { forwardRef, useState, type ComponentRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { fontFamilyForWeight } from "@/theme/typography";
import { radius, size } from "@/theme/layout";
import { useTheme } from "@/theme/useTheme";

/** Native input contract and ref are preserved for existing forms and tests. */
const AppInput = forwardRef<ComponentRef<typeof TextInput>, TextInputProps>(function AppInput({ style, onFocus, onBlur, ...props }, ref) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const resolved = StyleSheet.flatten(style) ?? {};
  return <TextInput ref={ref} placeholderTextColor={theme.placeholder} selectionColor={theme.brand} {...props}
    onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[styles.input, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }, style,
      { fontFamily: resolved.fontFamily ?? fontFamilyForWeight(resolved.fontWeight ?? "500") }, !resolved.fontFamily && { fontWeight: "normal" },
      focused && props.editable !== false && { borderColor: theme.brand }, props.editable === false && { opacity: 0.6 }]} />;
});
export default AppInput;

const styles = StyleSheet.create({
  input: { minHeight: size.control, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: fontFamilyForWeight("500") },
});
