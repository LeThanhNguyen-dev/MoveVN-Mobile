import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react-native";
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";

export const dateFieldLabel = (value: string) =>
  value ? value.split("-").reverse().join("/") : "Chọn ngày";
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Date-only picker; history filters must also allow dates in the past. */
export default function AppDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const firstWeekday = new Date(
    month.getFullYear(),
    month.getMonth(),
    1,
  ).getDay();
  const length = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <AppText style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${dateFieldLabel(value)}`}
        onPress={() => {
          setMonth(new Date(`${value || dateKey(new Date())}T12:00:00`));
          setOpen(true);
        }}
        style={[
          styles.field,
          { backgroundColor: theme.input, borderColor: theme.border },
        ]}
      >
        <CalendarDays size={16} color={theme.brand} />
        <AppText
          style={{
            flex: 1,
            fontSize: 12,
            color: value ? theme.text : theme.placeholder,
          }}
        >
          {dateFieldLabel(value)}
        </AppText>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Đóng lịch"
            accessibilityRole="button"
            onPress={() => setOpen(false)}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.dialog,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.row}>
              <AppText
                display
                style={{ color: theme.text, fontSize: 18, flex: 1 }}
              >
                {label}
              </AppText>
              <Pressable
                accessibilityLabel="Đóng lịch"
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={styles.icon}
              >
                <X size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tháng trước"
                  onPress={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                  style={styles.icon}
                >
                  <ChevronLeft color={theme.text} size={21} />
                </Pressable>
                <AppText
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 15,
                    color: theme.text,
                    fontWeight: "600",
                  }}
                >
                  Tháng {month.getMonth() + 1}, {month.getFullYear()}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tháng sau"
                  onPress={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                  style={styles.icon}
                >
                  <ChevronRight color={theme.text} size={21} />
                </Pressable>
              </View>
              <View style={styles.week}>
                {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
                  <AppText
                    key={day}
                    style={[styles.weekday, { color: theme.faint }]}
                  >
                    {day}
                  </AppText>
                ))}
              </View>
              <View style={styles.week}>
                {Array.from({ length: firstWeekday + length }, (_, index) => {
                  if (index < firstWeekday)
                    return <View key={`blank-${index}`} style={styles.day} />;
                  const day = index - firstWeekday + 1;
                  const key = dateKey(
                    new Date(month.getFullYear(), month.getMonth(), day),
                  );
                  const selected = value === key;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={dateFieldLabel(key)}
                      accessibilityState={{ selected }}
                      onPress={() => select(key)}
                      style={[
                        styles.day,
                        selected && { backgroundColor: theme.brandSolid },
                      ]}
                    >
                      <AppText
                        style={{
                          color: selected ? "#FFFFFF" : theme.text,
                          fontSize: 14,
                          fontWeight: selected ? "700" : "500",
                        }}
                      >
                        {day}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              <View
                style={[
                  styles.row,
                  {
                    marginTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: theme.divider,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => select("")}
                  style={styles.footerButton}
                >
                  <AppText style={{ color: theme.muted, fontSize: 13 }}>
                    Bỏ chọn ngày
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => select(dateKey(new Date()))}
                  style={styles.footerButton}
                >
                  <AppText
                    style={{
                      color: theme.brand,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    Hôm nay
                  </AppText>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  overlay: { flex: 1, justifyContent: "center", padding: 16 },
  dialog: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    maxHeight: "90%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  week: { flexDirection: "row", flexWrap: "wrap" },
  weekday: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 11,
    paddingVertical: 10,
  },
  day: {
    width: "14.2857%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  footerButton: {
    minHeight: 48,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
});
