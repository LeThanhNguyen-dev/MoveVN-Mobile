import {
  useFonts as useBeVietnamPro,
  BeVietnamPro_300Light,
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
  BeVietnamPro_800ExtraBold,
  BeVietnamPro_900Black,
  BeVietnamPro_400Regular_Italic,
} from "@expo-google-fonts/be-vietnam-pro";
import {
  useFonts as useQuicksand,
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from "@expo-google-fonts/quicksand";

/**
 * Load 2 font Google giống web: Be Vietnam Pro (body 300-900 + Italic 400)
 * và Quicksand (heading 400-700). Trả về true khi cả 2 bộ đã sẵn sàng.
 */
export function useAppFonts(): [boolean] {
  const [bodyLoaded] = useBeVietnamPro({
    BeVietnamPro_300Light,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
    BeVietnamPro_800ExtraBold,
    BeVietnamPro_900Black,
    BeVietnamPro_400Regular_Italic,
  });
  const [displayLoaded] = useQuicksand({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });
  return [bodyLoaded && displayLoaded];
}
