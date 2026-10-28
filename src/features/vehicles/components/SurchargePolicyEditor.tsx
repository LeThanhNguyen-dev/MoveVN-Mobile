import { Plus, Trash2 } from "lucide-react-native";
import { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Switch, TextInput, View } from "react-native"
import AppText from "@/components/AppText";
import type { VehicleSurchargePolicy } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type Props = {
  value: VehicleSurchargePolicy[];
  onChange: (value: VehicleSurchargePolicy[]) => void;
  onDescriptionFocus?: (input: TextInput) => void;
  onDescriptionBlur?: (input: TextInput) => void;
};

const feeTypeOptions = [
  { value: "ExcessMileage", label: "Vượt km" },
  { value: "LateReturn", label: "Quá giờ" },
  { value: "Cleaning", label: "Vệ sinh" },
  { value: "Deodorization", label: "Khử mùi" },
  { value: "Custom", label: "Khác" },
] as const;

const calculationOptions = [
  { value: "PerKm", label: "Theo km" },
  { value: "PerHour", label: "Theo giờ" },
  { value: "PerDay", label: "Theo ngày" },
  { value: "Fixed", label: "Cố định" },
] as const;

const defaultByType: Record<
  VehicleSurchargePolicy["feeType"],
  Pick<VehicleSurchargePolicy, "name" | "calculationMethod" | "description">
> = {
  ExcessMileage: { name: "Phí vượt giới hạn", calculationMethod: "PerKm", description: "Phụ phí phát sinh nếu di chuyển quá số km được bao gồm khi thuê xe." },
  LateReturn: { name: "Phí quá giờ", calculationMethod: "PerHour", description: "Phụ phí phát sinh nếu hoàn trả xe trễ giờ." },
  Cleaning: { name: "Phí vệ sinh", calculationMethod: "Fixed", description: "Áp dụng khi xe hoàn trả không đảm bảo vệ sinh." },
  Deodorization: { name: "Phí khử mùi", calculationMethod: "Fixed", description: "Áp dụng khi xe có mùi thuốc lá hoặc thực phẩm nặng mùi." },
  Custom: { name: "Phí khác", calculationMethod: "Fixed", description: "" },
};

/** Ưu tiên giờ, fallback dữ liệu cũ (phút) quy đổi sang giờ. */
function resolveHours(hours?: number | null, minutes?: number | null) {
  if (hours != null && Number(hours) >= 0) return Number(hours);
  if (minutes != null && Number(minutes) >= 0) return Number(minutes) / 60;
  return null;
}

function hoursInputValue(hours?: number | null) {
  if (hours == null) return "";
  return Number.isInteger(hours) ? String(hours) : String(Number(Number(hours).toFixed(2)));
}

function parseHoursInput(text: string) {
  if (!text.trim()) return null;
  const hours = Number(text);
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
}

export function isSurchargePoliciesValid(policies: VehicleSurchargePolicy[]) {
  return policies.every((policy) => policy.name.trim() && policy.feeType && policy.calculationMethod && Number(policy.unitPrice) > 0);
}

export function normalizeSurchargePolicies(policies: VehicleSurchargePolicy[]) {
  return policies
    .filter((policy) => policy.name.trim() && Number(policy.unitPrice) > 0)
    .map((policy) => {
      const lateGraceHours =
        policy.lateGraceHours != null && Number(policy.lateGraceHours) >= 0
          ? Number(policy.lateGraceHours)
          : resolveHours(policy.lateGraceHours, policy.lateGraceMinutes);
      const lateDayThresholdHours =
        policy.lateDayThresholdHours != null && Number(policy.lateDayThresholdHours) >= 0
          ? Number(policy.lateDayThresholdHours)
          : resolveHours(policy.lateDayThresholdHours, policy.lateDayThresholdMinutes);
      return {
        ...policy,
        unitPrice: Number(policy.unitPrice),
        includedKm: policy.includedKm != null && Number(policy.includedKm) >= 0 ? Number(policy.includedKm) : null,
        lateGraceHours,
        lateDayThresholdHours,
        lateGraceMinutes: lateGraceHours != null ? Math.round(lateGraceHours * 60) : null,
        lateDayThresholdMinutes: lateDayThresholdHours != null ? Math.round(lateDayThresholdHours * 60) : null,
        lateDailyRate: policy.lateDailyRate != null && Number(policy.lateDailyRate) > 0 ? Number(policy.lateDailyRate) : null,
        maxAmount: policy.maxAmount != null && Number(policy.maxAmount) > 0 ? Number(policy.maxAmount) : null,
      };
    });
}

function numberText(value?: number | null) {
  return value != null && Number(value) > 0 ? String(value) : "";
}

function optionalNumber(text: string) {
  return text.trim() ? Number(text) : null;
}

export default function SurchargePolicyEditor({ value, onChange, onDescriptionFocus, onDescriptionBlur }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const descriptionInputRefs = useRef<Record<number, TextInput | null>>({});

  function update(index: number, patch: Partial<VehicleSurchargePolicy>) {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addPolicy(type: VehicleSurchargePolicy["feeType"] = "ExcessMileage") {
    const preset = defaultByType[type];
    onChange([
      ...value,
      {
        feeType: type,
        name: preset.name,
        description: preset.description,
        calculationMethod: preset.calculationMethod,
        unitPrice: 0,
        includedKm: type === "ExcessMileage" ? 300 : null,
        allowanceScope: type === "ExcessMileage" ? "PerDay" : null,
        lateGraceHours: type === "LateReturn" ? 1 : null,
        lateDayThresholdHours: type === "LateReturn" ? 6 : null,
        lateGraceMinutes: type === "LateReturn" ? 60 : null,
        lateDayThresholdMinutes: type === "LateReturn" ? 360 : null,
        lateDailyRate: null,
        maxAmount: null,
        isActive: true,
      },
    ]);
  }

  function removePolicy(index: number) {
    const policy = value[index];
    if (policy?.id) {
      update(index, { isActive: false });
      return;
    }
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText display style={styles.title}>Phụ phí có thể phát sinh</AppText>
          <AppText style={styles.sub}>Chỉ cấu hình quy định cho xe, chưa tính vào booking ở bước này. Thời gian tính theo giờ.</AppText>
        </View>
        <Pressable onPress={() => addPolicy()} style={styles.addBtn}>
          <Plus color={theme.onBrand} size={14} />
          <AppText style={styles.addText}>Thêm</AppText>
        </Pressable>
      </View>

      {value.length === 0 ? <AppText style={styles.empty}>Chưa cấu hình phụ phí.</AppText> : null}

      {value.map((policy, index) => (
        <View key={`${policy.id ?? "new"}-${index}`} style={[styles.card, !policy.isActive && styles.cardInactive]}>
          <View style={styles.rowBetween}>
            <AppText display style={styles.cardTitle}>{policy.name || "Phụ phí"}</AppText>
            <View style={styles.actions}>
              <Switch value={policy.isActive} onValueChange={(checked) => update(index, { isActive: checked })} trackColor={{ false: theme.faint, true: theme.brand }} />
              <Pressable onPress={() => removePolicy(index)} style={styles.iconBtn}>
                <Trash2 color={theme.danger} size={15} />
              </Pressable>
            </View>
          </View>

          <AppText style={styles.label}>Loại phí</AppText>
          <View style={styles.chips}>
            {feeTypeOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  const preset = defaultByType[option.value];
                  update(index, { feeType: option.value, name: preset.name, description: preset.description, calculationMethod: preset.calculationMethod });
                }}
                style={[styles.chip, policy.feeType === option.value && styles.chipActive]}
              >
                <AppText style={[styles.chipText, policy.feeType === option.value && styles.chipTextActive]}>{option.label}</AppText>
              </Pressable>
            ))}
          </View>

          <AppText style={styles.label}>Tên phí *</AppText>
          <TextInput value={policy.name} onChangeText={(text) => update(index, { name: text })} style={styles.input} placeholderTextColor={theme.placeholder} />

          <AppText style={styles.label}>Cách tính *</AppText>
          <View style={styles.chips}>
            {calculationOptions.map((option) => (
              <Pressable key={option.value} onPress={() => update(index, { calculationMethod: option.value })} style={[styles.chip, policy.calculationMethod === option.value && styles.chipActive]}>
                <AppText style={[styles.chipText, policy.calculationMethod === option.value && styles.chipTextActive]}>{option.label}</AppText>
              </Pressable>
            ))}
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <AppText style={styles.label}>Đơn giá *</AppText>
              <TextInput
                value={numberText(policy.unitPrice)}
                onChangeText={(text) => update(index, { unitPrice: optionalNumber(text) ?? 0 })}
                keyboardType="numeric"
                placeholder="VD: 5000"
                placeholderTextColor={theme.placeholder}
                style={styles.input}
              />
            </View>
            <View style={styles.col}>
              <AppText style={styles.label}>Tối đa</AppText>
              <TextInput
                value={numberText(policy.maxAmount)}
                onChangeText={(text) => update(index, { maxAmount: optionalNumber(text) })}
                keyboardType="numeric"
                placeholder="Không bắt buộc"
                placeholderTextColor={theme.placeholder}
                style={styles.input}
              />
            </View>
          </View>

          {policy.feeType === "ExcessMileage" ? (
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <AppText style={styles.label}>Km bao gồm</AppText>
                <TextInput
                  value={numberText(policy.includedKm)}
                  onChangeText={(text) => update(index, { includedKm: optionalNumber(text) })}
                  keyboardType="numeric"
                  placeholder="VD: 300"
                  placeholderTextColor={theme.placeholder}
                  style={styles.input}
                />
              </View>
              <View style={styles.col}>
                <AppText style={styles.label}>Phạm vi</AppText>
                <View style={styles.scopeRow}>
                  {(["PerBooking", "PerDay"] as const).map((scope) => (
                    <Pressable key={scope} onPress={() => update(index, { allowanceScope: scope })} style={[styles.scopeBtn, (policy.allowanceScope ?? "PerBooking") === scope && styles.scopeBtnActive]}>
                      <AppText style={[styles.scopeText, (policy.allowanceScope ?? "PerBooking") === scope && styles.scopeTextActive]}>{scope === "PerDay" ? "Ngày" : "Chuyến"}</AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {policy.feeType === "LateReturn" ? (
            <>
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <AppText style={styles.label}>Miễn trễ (giờ)</AppText>
                  <TextInput
                    value={hoursInputValue(resolveHours(policy.lateGraceHours, policy.lateGraceMinutes))}
                    onChangeText={(text) => {
                      const hours = parseHoursInput(text);
                      update(index, { lateGraceHours: hours, lateGraceMinutes: hours != null ? Math.round(hours * 60) : null });
                    }}
                    keyboardType="numeric"
                    placeholder="VD: 1"
                    placeholderTextColor={theme.placeholder}
                    style={styles.input}
                  />
                </View>
                <View style={styles.col}>
                  <AppText style={styles.label}>Ngưỡng 1 ngày (giờ)</AppText>
                  <TextInput
                    value={hoursInputValue(resolveHours(policy.lateDayThresholdHours, policy.lateDayThresholdMinutes))}
                    onChangeText={(text) => {
                      const hours = parseHoursInput(text);
                      update(index, { lateDayThresholdHours: hours, lateDayThresholdMinutes: hours != null ? Math.round(hours * 60) : null });
                    }}
                    keyboardType="numeric"
                    placeholder="VD: 6"
                    placeholderTextColor={theme.placeholder}
                    style={styles.input}
                  />
                </View>
              </View>
              <AppText style={styles.label}>Giá/ngày trễ</AppText>
              <TextInput value={numberText(policy.lateDailyRate)} onChangeText={(text) => update(index, { lateDailyRate: optionalNumber(text) })} keyboardType="numeric" style={styles.input} />
            </>
          ) : null}

          <AppText style={styles.label}>Mô tả</AppText>
          <TextInput
            ref={(input) => {
              descriptionInputRefs.current[index] = input;
            }}
            value={policy.description ?? ""}
            onChangeText={(text) => update(index, { description: text })}
            onFocus={() => {
              const input = descriptionInputRefs.current[index];
              if (input) onDescriptionFocus?.(input);
            }}
            onBlur={() => {
              const input = descriptionInputRefs.current[index];
              if (input) onDescriptionBlur?.(input);
            }}
            multiline
            numberOfLines={2}
            scrollEnabled
            placeholderTextColor={theme.placeholder}
            style={[styles.input, styles.textArea]}
          />
        </View>
      ))}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    box: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.surfaceAlt, padding: 12, gap: 10 },
    header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    headerText: { flex: 1 },
    title: { color: theme.text, fontSize: 15, fontWeight: "800" },
    sub: { color: theme.muted, fontSize: 12, marginTop: 2 },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, backgroundColor: theme.brandSolid, paddingHorizontal: 12, paddingVertical: 9 },
    addText: { color: theme.onBrand, fontSize: 12, fontWeight: "800" },
    empty: { color: theme.faint, textAlign: "center", borderWidth: 1, borderStyle: "dashed", borderColor: theme.border, borderRadius: 12, paddingVertical: 14, fontSize: 12, fontWeight: "600" },
    card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.surface, padding: 12, gap: 8 },
    cardInactive: { opacity: 0.62 },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    cardTitle: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "800" },
    actions: { flexDirection: "row", alignItems: "center", gap: 4 },
    iconBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: theme.dangerSoft },
    label: { color: theme.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
    input: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface, paddingHorizontal: 12, height: 44, color: theme.text, fontSize: 13 },
    textArea: { height: 72, paddingVertical: 10, textAlignVertical: "top" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 10, paddingVertical: 7 },
    chipActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    chipText: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: theme.brand },
    twoCol: { flexDirection: "row", gap: 8 },
    col: { flex: 1, gap: 4 },
    scopeRow: { flexDirection: "row", gap: 6 },
    scopeBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface },
    scopeBtnActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    scopeText: { color: theme.muted, fontSize: 12, fontWeight: "800" },
    scopeTextActive: { color: theme.brand },
  });
