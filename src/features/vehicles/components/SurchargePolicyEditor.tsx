import { Plus, Trash2 } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { VehicleSurchargePolicy } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type Props = {
  value: VehicleSurchargePolicy[];
  onChange: (value: VehicleSurchargePolicy[]) => void;
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

function minutesToHoursInput(minutes?: number | null) {
  if (minutes == null) return "";
  const hours = Number(minutes) / 60;
  return Number.isInteger(hours) ? String(hours) : String(Number(hours.toFixed(2)));
}

function hoursInputToMinutes(value: string) {
  if (!value.trim()) return null;
  const hours = Number(value);
  return Number.isFinite(hours) && hours >= 0 ? Math.round(hours * 60) : null;
}

export function isSurchargePoliciesValid(policies: VehicleSurchargePolicy[]) {
  return policies.every((policy) => policy.name.trim() && policy.feeType && policy.calculationMethod && Number(policy.unitPrice) > 0);
}

export function normalizeSurchargePolicies(policies: VehicleSurchargePolicy[]) {
  return policies
    .filter((policy) => policy.name.trim() && Number(policy.unitPrice) > 0)
    .map((policy) => ({
      ...policy,
      unitPrice: Number(policy.unitPrice),
      includedKm: policy.includedKm != null && Number(policy.includedKm) >= 0 ? Number(policy.includedKm) : null,
      lateGraceMinutes: policy.lateGraceMinutes != null && Number(policy.lateGraceMinutes) >= 0 ? Number(policy.lateGraceMinutes) : null,
      lateDayThresholdMinutes:
        policy.lateDayThresholdMinutes != null && Number(policy.lateDayThresholdMinutes) >= 0 ? Number(policy.lateDayThresholdMinutes) : null,
      lateDailyRate: policy.lateDailyRate != null && Number(policy.lateDailyRate) > 0 ? Number(policy.lateDailyRate) : null,
      maxAmount: policy.maxAmount != null && Number(policy.maxAmount) > 0 ? Number(policy.maxAmount) : null,
    }));
}

function numberText(value?: number | null) {
  return value != null && Number(value) > 0 ? String(value) : "";
}

function optionalNumber(text: string) {
  return text.trim() ? Number(text) : null;
}

export default function SurchargePolicyEditor({ value, onChange }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
          <Text style={styles.title}>Phụ phí có thể phát sinh</Text>
          <Text style={styles.sub}>Chỉ cấu hình quy định cho xe, chưa tính vào booking ở bước này.</Text>
        </View>
        <Pressable onPress={() => addPolicy()} style={styles.addBtn}>
          <Plus color={theme.onBrand} size={14} />
          <Text style={styles.addText}>Thêm</Text>
        </Pressable>
      </View>

      {value.length === 0 ? <Text style={styles.empty}>Chưa cấu hình phụ phí.</Text> : null}

      {value.map((policy, index) => (
        <View key={`${policy.id ?? "new"}-${index}`} style={[styles.card, !policy.isActive && styles.cardInactive]}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{policy.name || "Phụ phí"}</Text>
            <View style={styles.actions}>
              <Switch value={policy.isActive} onValueChange={(checked) => update(index, { isActive: checked })} trackColor={{ false: theme.faint, true: theme.brand }} />
              <Pressable onPress={() => removePolicy(index)} style={styles.iconBtn}>
                <Trash2 color={theme.danger} size={15} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.label}>Loại phí</Text>
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
                <Text style={[styles.chipText, policy.feeType === option.value && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Tên phí *</Text>
          <TextInput value={policy.name} onChangeText={(text) => update(index, { name: text })} style={styles.input} placeholderTextColor={theme.placeholder} />

          <Text style={styles.label}>Cách tính *</Text>
          <View style={styles.chips}>
            {calculationOptions.map((option) => (
              <Pressable key={option.value} onPress={() => update(index, { calculationMethod: option.value })} style={[styles.chip, policy.calculationMethod === option.value && styles.chipActive]}>
                <Text style={[styles.chipText, policy.calculationMethod === option.value && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.label}>Đơn giá *</Text>
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
              <Text style={styles.label}>Tối đa</Text>
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
                <Text style={styles.label}>Km bao gồm</Text>
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
                <Text style={styles.label}>Phạm vi</Text>
                <View style={styles.scopeRow}>
                  {(["PerBooking", "PerDay"] as const).map((scope) => (
                    <Pressable key={scope} onPress={() => update(index, { allowanceScope: scope })} style={[styles.scopeBtn, (policy.allowanceScope ?? "PerBooking") === scope && styles.scopeBtnActive]}>
                      <Text style={[styles.scopeText, (policy.allowanceScope ?? "PerBooking") === scope && styles.scopeTextActive]}>{scope === "PerDay" ? "Ngày" : "Chuyến"}</Text>
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
                  <Text style={styles.label}>Miễn trễ (giờ)</Text>
                  <TextInput value={minutesToHoursInput(policy.lateGraceMinutes)} onChangeText={(text) => update(index, { lateGraceMinutes: hoursInputToMinutes(text) })} keyboardType="numeric" style={styles.input} />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Ngưỡng 1 ngày (giờ)</Text>
                  <TextInput value={minutesToHoursInput(policy.lateDayThresholdMinutes)} onChangeText={(text) => update(index, { lateDayThresholdMinutes: hoursInputToMinutes(text) })} keyboardType="numeric" style={styles.input} />
                </View>
              </View>
              <Text style={styles.label}>Giá/ngày trễ</Text>
              <TextInput value={numberText(policy.lateDailyRate)} onChangeText={(text) => update(index, { lateDailyRate: optionalNumber(text) })} keyboardType="numeric" style={styles.input} />
            </>
          ) : null}

          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            value={policy.description ?? ""}
            onChangeText={(text) => update(index, { description: text })}
            multiline
            numberOfLines={2}
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
    addBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, backgroundColor: theme.brand, paddingHorizontal: 12, paddingVertical: 9 },
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
