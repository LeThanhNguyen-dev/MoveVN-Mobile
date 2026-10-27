import { memo, type ReactNode } from "react";
import { StyleSheet, Text, type TextProps } from "react-native";
import { fontFamilyForWeight } from "@/theme/typography";

type AppTextProps = TextProps & {
  /** Dùng Quicksand cho heading/điểm nhấn (mirror web font-sans). Mặc định Be Vietnam Pro. */
  display?: boolean;
  children?: ReactNode;
};

/**
 * Text mặc định toàn app: tự map fontWeight trong style sang đúng
 * family Be Vietnam Pro (body) hoặc Quicksand (display).
 * Nếu style đã có fontFamily riêng (vd. "monospace" cho mã voucher) thì giữ nguyên.
 */
function AppText({ style, display = false, ...rest }: AppTextProps) {
  const resolved = StyleSheet.flatten(style) ?? {};
  const family = resolved.fontFamily ?? (
    resolved.fontStyle === "italic" && !display && (!resolved.fontWeight || resolved.fontWeight === "400" || resolved.fontWeight === "normal")
      ? "BeVietnamPro_400Regular_Italic"
      : fontFamilyForWeight(resolved.fontWeight ?? (display ? "700" : "500"), display)
  );
  // Keep inherited colours for nested text, and preserve explicit monospace families.
  const lineHeight = resolved.fontSize ? Math.max(resolved.lineHeight ?? 0, Math.ceil(resolved.fontSize * 1.4)) : undefined;
  return <Text {...rest} style={[style, { fontFamily: family }, lineHeight !== undefined && { lineHeight }, !resolved.fontFamily && { fontWeight: "normal" }]} />;
}

export default memo(AppText);
