import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  DAYS_VI,
  DEFAULT_HOUR,
  HOUR_OPTIONS,
  MONTHS_VI,
  calculateRentalDays,
  formatDateValue,
  formatPeriodPart,
  getFirstAvailableHour,
  getHour,
  getRangeError,
  isPastHour,
  parseDateValue,
  withDateAndHour,
} from "@/features/vehicles/utils/rentalPeriod";

type RentalPeriodSheetProps = {
  visible: boolean;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClose: () => void;
};

function HourPicker({
  label,
  dateValue,
  value,
  disabled,
  onChange,
}: {
  label: string;
  dateValue: string;
  value: string;
  disabled: boolean;
  onChange: (hour: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [open, setOpen] = useState(false);
  const now = Date.now();

  return (
    <View style={styles.hourBlock}>
      <Text style={styles.hourLabel}>
        <Clock color={theme.muted} size={13} /> {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        style={[styles.hourButton, disabled && styles.disabled]}
      >
        <Text style={styles.hourButtonText}>{value}</Text>
        <ChevronDown color={theme.muted} size={16} />
      </Pressable>
      {open ? (
        <ScrollView style={styles.hourList} nestedScrollEnabled>
          {HOUR_OPTIONS.map((hour) => {
            const hourDisabled = isPastHour(dateValue, hour, now);
            const selected = hour === value;
            return (
              <Pressable
                key={hour}
                disabled={hourDisabled}
                onPress={() => {
                  onChange(hour);
                  setOpen(false);
                }}
                style={[styles.hourOption, selected && styles.hourOptionSelected]}
              >
                <Text
                  style={[
                    styles.hourOptionText,
                    hourDisabled && styles.hourOptionDisabled,
                    selected && styles.hourOptionSelectedText,
                  ]}
                >
                  {hour}
                </Text>
                {selected ? <Check color={theme.brand} size={15} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

export default function RentalPeriodSheet({
  visible,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClose,
}: RentalPeriodSheetProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const initialDate = parseDateValue(startDate) ?? new Date();
  const [month, setMonth] = useState(initialDate.getMonth());
  const [year, setYear] = useState(initialDate.getFullYear());

  const start = useMemo(() => parseDateValue(startDate), [startDate]);
  const end = useMemo(() => parseDateValue(endDate), [endDate]);
  const startValue = start ? formatDateValue(start) : "";
  const endValue = end ? formatDateValue(end) : "";

  const today = new Date();
  const todayValue = formatDateValue(today);
  const currentMonthValue = today.getFullYear() * 12 + today.getMonth();
  const visibleMonthValue = year * 12 + month;
  const rangeError = getRangeError(startDate, endDate);
  const rentalDays = useMemo(() => calculateRentalDays(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    if (visible) {
      const selectedDate = parseDateValue(startDate) ?? new Date();
      setMonth(selectedDate.getMonth());
      setYear(selectedDate.getFullYear());
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, startDate, slideAnim]);

  function handleClose() {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose());
  }

  function selectDate(date: Date) {
    const selectedValue = formatDateValue(date);

    if (!start || end) {
      const availableHour = getFirstAvailableHour(date, getHour(startDate));
      if (!availableHour) return;
      onStartDateChange(withDateAndHour(date, availableHour));
      onEndDateChange("");
      return;
    }

    if (selectedValue === startValue) {
      onStartDateChange("");
      onEndDateChange("");
      return;
    }

    if (selectedValue < startValue) {
      const availableHour = getFirstAvailableHour(date, getHour(startDate));
      if (!availableHour) return;
      onStartDateChange(withDateAndHour(date, availableHour));
      onEndDateChange("");
      return;
    }

    onEndDateChange(withDateAndHour(date, getHour(endDate) || DEFAULT_HOUR));
  }

  function moveMonth(offset: number) {
    const next = new Date(year, month + offset, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: ({ key: string; empty?: boolean; date?: Date } | null)[] = [];
  for (let i = 0; i < firstDay; i += 1) cells.push({ key: `empty-${i}`, empty: true });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `day-${day}`, date: new Date(year, month, day) });
  }

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Đóng lịch" />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Chọn thời gian thuê</Text>
              <Text style={styles.headerSub}>Chọn ngày nhận trước, sau đó chọn ngày trả.</Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton} accessibilityLabel="Đóng lịch">
              <X color={theme.muted} size={18} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.calendarCard}>
              <View style={styles.monthRow}>
                <Pressable
                  disabled={visibleMonthValue <= currentMonthValue}
                  onPress={() => moveMonth(-1)}
                  style={styles.monthButton}
                >
                  <ChevronLeft color={theme.muted} size={18} />
                </Pressable>
                <Text style={styles.monthLabel}>
                  {MONTHS_VI[month]} {year}
                </Text>
                <Pressable onPress={() => moveMonth(1)} style={styles.monthButton}>
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
              <View style={styles.daysGrid}>
                {cells.map((cell) => {
                  if (!cell || cell.empty || !cell.date) return <View key={cell?.key} style={styles.dayCell} />;
                  const date = cell.date;
                  const dateValue = formatDateValue(date);
                  const isPast =
                    dateValue < todayValue ||
                    (dateValue === todayValue && isPastHour(dateValue, "23:00"));
                  const isStart = dateValue === startValue;
                  const isEnd = dateValue === endValue;
                  const isInRange = Boolean(
                    startValue && endValue && dateValue > startValue && dateValue < endValue,
                  );
                  return (
                    <View key={cell.key} style={styles.dayCell}>
                      <Pressable
                        disabled={isPast}
                        onPress={() => selectDate(date)}
                        style={[
                          styles.dayButton,
                          (isStart || isEnd) && styles.daySelected,
                          isInRange && styles.dayInRange,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isPast && styles.dayPast,
                            (isStart || isEnd) && styles.daySelectedText,
                            isInRange && styles.dayInRangeText,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              <View style={styles.legendRow}>
                <Text style={styles.legend}>● Ngày đã chọn  ░ Trong khoảng</Text>
              </View>
            </View>

            <View style={styles.hoursRow}>
              <HourPicker
                label="Giờ nhận xe"
                dateValue={startDate}
                value={getHour(startDate)}
                disabled={!startDate}
                onChange={(hour) => {
                  if (start) onStartDateChange(withDateAndHour(start, hour));
                }}
              />
              <HourPicker
                label="Giờ trả xe"
                dateValue={endDate}
                value={getHour(endDate)}
                disabled={!endDate}
                onChange={(hour) => {
                  if (end) onEndDateChange(withDateAndHour(end, hour));
                }}
              />
            </View>
            {rangeError ? <Text style={styles.error}>{rangeError}</Text> : null}

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Thời gian đã chọn</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Nhận xe</Text>
                  <Text style={styles.summaryValue}>{formatPeriodPart(startDate)}</Text>
                </View>
                <Text style={styles.summaryArrow}>→</Text>
                <View style={[styles.summaryCol, styles.summaryColRight]}>
                  <Text style={styles.summaryLabel}>Trả xe</Text>
                  <Text style={styles.summaryValue}>{formatPeriodPart(endDate)}</Text>
                </View>
              </View>
              <View style={styles.summaryDaysRow}>
                <Text style={styles.summaryLabel}>Số ngày</Text>
                <Text style={styles.summaryDays}>{rentalDays > 0 ? `${rentalDays} ngày` : "-"}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              disabled={!startDate && !endDate}
              onPress={() => {
                onStartDateChange("");
                onEndDateChange("");
              }}
            >
              <Text style={styles.clearText}>Xóa thời gian</Text>
            </Pressable>
            <Pressable
              disabled={!startDate || !endDate || Boolean(rangeError)}
              onPress={handleClose}
              style={[
                styles.doneButton,
                (!startDate || !endDate || Boolean(rangeError)) && styles.doneDisabled,
              ]}
            >
              <Text style={styles.doneText}>Hoàn tất</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: theme.overlay },
    backdrop: { ...StyleSheet.absoluteFill },
    sheet: {
      width: "100%",
      height: "68%",
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginBottom: 10,
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    headerSub: { color: theme.muted, fontSize: 12, marginTop: 2 },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, marginTop: 12 },
    calendarCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: theme.surface,
    },
    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    monthButton: { padding: 6 },
    monthLabel: { color: theme.text, fontSize: 14, fontWeight: "800" },
    weekRow: { flexDirection: "row", marginTop: 8 },
    weekLabel: { flex: 1, textAlign: "center", color: theme.faint, fontSize: 11, fontWeight: "700" },
    daysGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
    dayCell: { width: "14.28%", alignItems: "center", justifyContent: "center", paddingVertical: 2 },
    dayButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    dayText: { color: theme.text, fontSize: 13, fontWeight: "500" },
    dayPast: { color: theme.faint },
    daySelected: { backgroundColor: theme.brand },
    daySelectedText: { color: theme.onBrand, fontWeight: "800" },
    dayInRange: { backgroundColor: theme.brandSoft, borderRadius: 8 },
    dayInRangeText: { color: theme.brand, fontWeight: "700" },
    legendRow: { marginTop: 8 },
    legend: { color: theme.muted, fontSize: 11 },
    hoursRow: { flexDirection: "row", gap: 12, marginTop: 12 },
    hourBlock: { flex: 1 },
    hourLabel: { color: theme.text, fontSize: 12, fontWeight: "700", marginBottom: 6 },
    hourButton: {
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.input,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    hourButtonText: { color: theme.text, fontSize: 14, fontWeight: "700" },
    hourList: {
      maxHeight: 180,
      marginTop: 6,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
    },
    hourOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    hourOptionSelected: { backgroundColor: theme.brandSoft },
    hourOptionText: { color: theme.text, fontSize: 14 },
    hourOptionDisabled: { color: theme.faint },
    hourOptionSelectedText: { color: theme.brand, fontWeight: "800" },
    disabled: { opacity: 0.5 },
    error: { color: theme.danger, fontSize: 12, fontWeight: "600", marginTop: 8 },
    summaryCard: {
      marginTop: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      padding: 12,
    },
    summaryTitle: { color: theme.brand, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    summaryRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
    summaryCol: { flex: 1 },
    summaryColRight: { alignItems: "flex-end" },
    summaryLabel: { color: theme.muted, fontSize: 11, fontWeight: "600" },
    summaryValue: { color: theme.text, fontSize: 12, fontWeight: "700", marginTop: 2 },
    summaryArrow: { color: theme.brand, fontSize: 16, fontWeight: "800" },
    summaryDaysRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.brandBorder,
    },
    summaryDays: { color: theme.text, fontSize: 14, fontWeight: "800" },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
      marginTop: 8,
    },
    clearText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    doneButton: {
      height: 44,
      paddingHorizontal: 22,
      borderRadius: 12,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    doneDisabled: { opacity: 0.4 },
    doneText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
  });
