import { useMemo, useState } from "react";
import { Image } from "expo-image";
import { Landmark } from "lucide-react-native";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import AppText from "@/components/AppText";
import { findVietnamBank } from "@/features/wallets/data/banks";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type BankLogoProps = {
  bin?: string | null;
  name?: string | null;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export default function BankLogo({
  bin,
  name,
  width = 64,
  height = 40,
  style,
}: BankLogoProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bank = findVietnamBank(bin, name);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logo = bank?.logo;
  const showLogo = Boolean(logo && failedLogo !== logo);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={bank?.shortName ?? name ?? "Bank"}
      style={[styles.frame, { width, height }, style]}
    >
      {showLogo && logo ? (
        <Image
          source={{ uri: logo }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={120}
          onError={() => setFailedLogo(logo)}
          style={[styles.logo, { transform: [{ scale: bank.logoScale ?? 1 }] }]}
        />
      ) : bank ? (
        <AppText style={styles.fallbackText}>{bank.code}</AppText>
      ) : (
        <Landmark color={theme.muted} size={20} strokeWidth={2} />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  frame: {
    flexShrink: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: "#FFFFFF",
    padding: 4,
  },
  logo: { width: "100%", height: "100%" },
  fallbackText: { color: theme.brand, fontSize: 11, fontWeight: "800" },
});
