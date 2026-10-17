import { memo, useMemo, type ReactNode } from "react";
import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";
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
function AppText({ display = false, style, ...rest }: AppTextProps) {
  const resolvedStyle = useMemo<TextProps["style"]>(() => {
    const flat = StyleSheet.flatten(style) as TextStyle | undefined;
    // Đã có family riêng (monospace...) hoặc chưa load font: giữ nguyên style.
    if (flat?.fontFamily) return style;
    return [
      { fontFamily: fontFamilyForWeight(flat?.fontWeight, display) },
      style,
      // Gỡ fontWeight để Android không render sai khi đã có family cụ thể.
      { fontWeight: undefined },
    ];
  }, [style, display]);

  // NOTE: dùng Text gốc của RN ở đây (không dùng AppText để tránh đệ quy).
  return (
    <Text style={resolvedStyle} {...rest} />
  );
}

export default memo(AppText);
