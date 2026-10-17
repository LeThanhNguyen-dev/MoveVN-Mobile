import { memo, type ReactNode } from "react";
import { Text, type TextProps } from "react-native";

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
function AppText({ style, ...rest }: AppTextProps) {
  // Revert về Text mặc định của RN (không ép font custom) để khớp nhánh wallet-revamp.
  return <Text style={style} {...rest} />;
}

export default memo(AppText);
