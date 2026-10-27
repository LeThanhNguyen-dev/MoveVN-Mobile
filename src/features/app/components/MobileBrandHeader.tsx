import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CarFront,
  CircleHelp,
  Heart,
  Home,
  Menu,
  UserRound,
  X,
} from "lucide-react-native";
import AppText from "@/components/AppText";
import NotificationBell from "@/features/notifications/components/NotificationBell";
import { openFavoriteVehicles } from "@/features/favorites/favoriteActions";
import { useTheme } from "@/theme/useTheme";

export type ExperiencePage = "home" | "how" | "owners" | "support";
const pages = [
  { key: "home", label: "Trang chủ", icon: Home },
  { key: "how", label: "Cách hoạt động", icon: BookOpen },
  { key: "owners", label: "Dành cho chủ xe", icon: CarFront },
  { key: "support", label: "Trung tâm hỗ trợ", icon: CircleHelp },
] as const;

export default function MobileBrandHeader({
  onNavigate,
  onAccount,
  onBack,
  activePage = "home",
  favorites = false,
}: {
  onNavigate: (page: ExperiencePage) => void;
  onAccount?: () => void;
  onBack?: () => void;
  activePage?: ExperiencePage;
  favorites?: boolean;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const closeThen = (action: () => void) => {
    setOpen(false);
    action();
  };
  return (
    <>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.divider },
        ]}
      >
        {onBack && (
          <Pressable
            accessibilityLabel="Quay lại"
            accessibilityRole="button"
            onPress={onBack}
            style={styles.icon}
          >
            <ArrowLeft color={theme.text} size={22} />
          </Pressable>
        )}
        <Pressable
          accessibilityLabel="MoveVN · Trang chủ"
          accessibilityRole="button"
          onPress={() => onNavigate("home")}
          style={styles.logoTouch}
        >
          <Image
            accessibilityLabel="MoveVN"
            resizeMode="contain"
            source={
              theme.mode === "dark"
                ? require("../../../../Logo/movevn_horizontal_dark.png")
                : require("../../../../Logo/logo-noslogan-ligh.png")
            }
            style={styles.logo}
          />
        </Pressable>
        <NotificationBell />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở menu"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}
          style={styles.icon}
        >
          <Menu size={23} color={theme.text} />
        </Pressable>
      </View>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng menu"
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.menu,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.menuTitle}>
              <AppText display style={{ fontSize: 22, color: theme.text }}>
                Khám phá MoveVN
              </AppText>
              <Pressable
                accessibilityLabel="Đóng menu"
                accessibilityRole="button"
                style={styles.icon}
                onPress={() => setOpen(false)}
              >
                <X color={theme.text} size={22} />
              </Pressable>
            </View>
            <ScrollView>
              {pages.map(({ key, label, icon: Icon }) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activePage === key }}
                  onPress={() => closeThen(() => onNavigate(key))}
                  style={[
                    styles.menuRow,
                    activePage === key && { backgroundColor: theme.brandSoft },
                  ]}
                >
                  <Icon size={21} color={theme.brand} />
                  <AppText style={[styles.menuLabel, { color: theme.text }]}>
                    {label}
                  </AppText>
                  <ArrowRight size={17} color={theme.faint} />
                </Pressable>
              ))}
              {favorites && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => closeThen(openFavoriteVehicles)}
                  style={styles.menuRow}
                >
                  <Heart color={theme.danger} size={21} />
                  <AppText style={[styles.menuLabel, { color: theme.text }]}>
                    Xe yêu thích
                  </AppText>
                </Pressable>
              )}
              {onAccount && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => closeThen(onAccount)}
                  style={styles.menuRow}
                >
                  <UserRound color={theme.brand} size={21} />
                  <AppText style={[styles.menuLabel, { color: theme.text }]}>
                    Hồ sơ tài khoản
                  </AppText>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 60,
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
  },
  logoTouch: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center", alignItems: "flex-start" },
  logo: { width: 120, maxWidth: "100%", height: 40 },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: { flex: 1, justifyContent: "center", padding: 20 },
  menu: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    maxHeight: "85%",
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  menuTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  menuRow: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
  },
  menuLabel: { flex: 1, fontWeight: "600", fontSize: 14 },
});
