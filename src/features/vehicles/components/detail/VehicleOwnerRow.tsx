import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { detailFont, useDetailTheme } from "./detailTheme";

type Props = {
  ownerName: string;
  ownerId: number | null;
  onOpenProfile?: (userId: number) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

export default function VehicleOwnerRow({ ownerName, ownerId, onOpenProfile }: Props) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const canOpen = Boolean(onOpenProfile && ownerId);
  const displayName = ownerName || "Chưa cập nhật";

  const body = (
    <>
      <LinearGradient colors={p.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
        <AppText style={styles.avatarText}>{initials(displayName)}</AppText>
      </LinearGradient>
      <View style={styles.body}>
        <AppText style={styles.name} numberOfLines={1}>
          {displayName}
        </AppText>
        <AppText style={styles.role} numberOfLines={1}>
          Chủ xe{canOpen ? " · Xem hồ sơ" : ""}
        </AppText>
      </View>
      {canOpen ? <ChevronRight color={p.faint} size={17} strokeWidth={2.1} /> : null}
    </>
  );

  if (canOpen && onOpenProfile && ownerId) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Xem hồ sơ chủ xe ${displayName}`}
        onPress={() => onOpenProfile(ownerId)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.row}>{body}</View>;
}

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"]) =>
  StyleSheet.create({
    row: {
      marginTop: 18,
      marginHorizontal: 20,
      paddingBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: p.line,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    avatarText: { color: "#FFFFFF", fontFamily: detailFont.display, fontSize: 15 },
    body: { flex: 1, minWidth: 0 },
    name: { color: p.ink, fontFamily: detailFont.bold, fontSize: 13 },
    role: { color: p.muted, fontFamily: detailFont.regular, fontSize: 10.5, marginTop: 2 },
    pressed: { opacity: 0.65 },
  });
