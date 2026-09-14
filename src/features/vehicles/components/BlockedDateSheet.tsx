import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { memo, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  DAYS_VI,
  MONTHS_VI,
  formatDateValue,
  parseDateValue,
} from "@/features/vehicles/utils/rentalPeriod";

type BlockedDateSheetProps = {
  visible: boolean;
  blockedKeys: Set<string>;
  bookedKeys: Set<string>;
  saving: boolean;
  onClose: () => void;
  onConfirm: (from: string, to: string, reason: string) => void;
};

function BlockedDateSheet({
  visible,
  blockedKeys,
  bookedKeys,
  saving,
  onClose,
  onConfirm,
}: BlockedDateSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [startKey, setStartKey] = useState("");
  const [endKey, setEndKey] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (visible) {
      const now = new Date();
      setMonth(now.getMonth());
      setYear(now.getFullYear());
      setStartKey("");
      setEndKey("");
      setReason("");
    }
  }, [visible]);

  function selectDate(date: Date) {
    const key = formatDateValue(date);
    if (blockedKeys.has(key) || bookedKeys.has(key)) return;
    if (!startKey || (startKey && endKey)) {
      setStartKey(key);
      setEndKey("");
      return;
    }
    if (key === startKey) {
      setStartKey("");
      return;
    }
    if (key < startKey) {
      setStartKey(key);
      setEndKey("");
      return;
    }
    // kiểm tra khoảng có vướng ngày chặn/đặt không
    let cur = startKey;
    let guard = 0;
    while (cur <= key && guard < 400) {
      if (blockedKeys.has(cur) || bookedKeys.has(cur)) {
        setStartKey(key);
        setEndKey("");
        return;
      }
      const d = parseDateValue(cur);
      if (!d) break;
      d.setDate(d.getDate() + 1);
      cur = formatDateValue(d);
      guard += 1;
    }
    setEndKey(key);
  }

  function moveMonth(offset: number) {
    const next = new Date(year, month + offset, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  }

  const todayKey = formatDateValue(today);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { key: string; date: Date | null }[] = [];
  for (let i = 0; i < firstDay; i += 1) cells.push({ key: `e-${i}`, date: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `d-${day}`, date: new Date(year, month, day) });
  }

  const from = startKey;
  const to = endKey || startKey;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.head}>
            <View>
              <Text style={styles.title}>Chặn ngày</Text>
              <Text style={styles.sub}>Chạm ngày bắt đầu, chạm tiếp ngày kết thúc.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X color={theme.muted} size={18} />
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            <Pressable
              disabled={year * 12 + month <= today.getFullYear() * 12 + today.getMonth()}
              onPress={() => moveMonth(-1)}
              style={styles.monthBtn}
            >
              <ChevronLeft color={theme.muted} size={18} />
            </Pressable>
            <Text style={styles.monthLabel}>
              {MONTHS_VI[month]} {year}
            </Text>
            <Pressable onPress={() => moveMonth(1)} style={styles.monthBtn}>
              <ChevronRight color={theme.muted} size={18} />
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {DAYS_VI.map((d) => (
              <Text key={d} style={styles.weekLabel}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((cell) => {
              if (!cell.date) return <View key={cell.key} style={styles.cell} />;
              const key = formatDateValue(cell.date);
              const isPast = key < todayKey;
              const isBlocked = blockedKeys.has(key);
              const isBooked = bookedKeys.has(key);
              const locked = isBlocked || isBooked;
              const isStart = key === startKey;
              const isEnd = key === endKey;
              const inRange = !!startKey && !!endKey && key > startKey && key < endKey;
              return (
                <View key={cell.key} style={styles.cell}>
                  <Pressable
                    disabled={isPast || locked}
                    onPress={() => selectDate(cell.date as Date)}
                    style={[
                      styles.day,
                      (isStart || isEnd) && styles.daySelected,
                      inRange && styles.dayRange,
                      isBlocked && styles.dayBlocked,
                      isBooked && styles.dayBooked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isPast && styles.dayPast,
                        (isStart || isEnd) && styles.daySelectedText,
                        inRange && styles.dayRangeText,
                        isBlocked && styles.dayBlockedText,
                        isBooked && styles.dayBookedText,
                      ]}
                    >
                      {cell.date.getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, styles.dotBlocked]} />
              <Text style={styles.legendText}>Đã chặn</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, styles.dotBooked]} />
              <Text style={styles.legendText}>Đã đặt</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, styles.dotFree]} />
              <Text style={styles.legendText}>Còn trống</Text>
            </View>
          </View>

          <Text style={styles.summary}>
            {from
              ? `Chặn: ${from}${to && to !== from ? ` → ${to}` : " (1 ngày)"}`
              : "Chưa chọn ngày nào"}
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Lý do (VD: Bảo dưỡng...)"
            placeholderTextColor={theme.placeholder}
            style={styles.input}
          />
          <Pressable
            disabled={!from || saving}
            onPress={() => onConfirm(from, to, reason.trim())}
            style={[styles.confirmBtn, (!from || saving) && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color={theme.onBrand} size="small" />
            ) : (
              <Text style={styles.confirmText}>Xác nhận chặn</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default memo(BlockedDateSheet);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: theme.overlay },
    backdrop: { ...StyleSheet.absoluteFill } as object,
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 18,
      paddingTop: 14,
      gap: 10,
    },
    head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    title: { color: theme.text, fontSize: 15, fontWeight: "800" },
    sub: { color: theme.muted, fontSize: 12, marginTop: 2 },
    closeBtn: { padding: 6 },
    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    monthBtn: { padding: 6 },
    monthLabel: { color: theme.text, fontSize: 14, fontWeight: "800" },
    weekRow: { flexDirection: "row" },
    weekLabel: { flex: 1, textAlign: "center", color: theme.faint, fontSize: 11, fontWeight: "700" },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: { width: "14.28%", alignItems: "center", paddingVertical: 2 },
    day: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    dayText: { color: theme.text, fontSize: 13, fontWeight: "500" },
    dayPast: { color: theme.faint },
    daySelected: { backgroundColor: theme.brand },
    daySelectedText: { color: theme.onBrand, fontWeight: "800" },
    dayRange: { backgroundColor: theme.brandSoft, borderRadius: 8 },
    dayRangeText: { color: theme.brand, fontWeight: "700" },
    dayBlocked: { backgroundColor: theme.dangerSoft },
    dayBlockedText: { color: theme.danger, fontWeight: "700" },
    dayBooked: { backgroundColor: "#FEF3C7" },
    dayBookedText: { color: "#B45309", fontWeight: "700" },
    legend: { flexDirection: "row", gap: 14 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    dotBlocked: { backgroundColor: theme.danger },
    dotBooked: { backgroundColor: "#F59E0B" },
    dotFree: { backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border },
    legendText: { color: theme.muted, fontSize: 11, fontWeight: "600" },
    summary: { color: theme.text, fontSize: 13, fontWeight: "700" },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.input,
      paddingHorizontal: 12,
      height: 44,
      color: theme.text,
      fontSize: 14,
    },
    confirmBtn: {
      height: 46,
      borderRadius: 14,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
    disabled: { opacity: 0.5 },
  });
