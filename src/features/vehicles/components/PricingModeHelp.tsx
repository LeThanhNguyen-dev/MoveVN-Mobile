import { HelpCircle, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export default function PricingModeHelp() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={styles.helpButton}
        accessibilityRole="button"
        accessibilityLabel="Giải thích hình thức định giá"
      >
        <HelpCircle color={theme.muted} size={16} />
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Hình thức định giá</Text>
              <Pressable onPress={() => setVisible(false)} style={styles.closeButton}>
                <X color={theme.text} size={18} />
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Tự nhập giá</Text>
            <Text style={styles.body}>
              Giá cố định do chủ xe đặt và không bị hệ thống tăng/giảm theo nhu cầu, ngày cuối tuần hay ngày lễ.
            </Text>

            <Text style={styles.sectionTitle}>Giá tự động</Text>
            <Text style={styles.body}>
              Chủ xe đặt giá tối thiểu và tối đa. MoveVN tính giá từng ngày trong khung này dựa trên giá cơ sở theo dòng xe/khu vực,
              quy tắc ngày lễ hoặc cuối tuần, tỷ lệ xe đã được đặt trong khu vực và số ngày xe đang rảnh.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    helpButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.overlay,
      padding: 20,
    },
    sheet: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    title: { color: theme.text, fontSize: 16, fontWeight: "800" },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    sectionTitle: { color: theme.text, fontSize: 13, fontWeight: "800", marginTop: 6 },
    body: { color: theme.muted, fontSize: 13, lineHeight: 19 },
  });
