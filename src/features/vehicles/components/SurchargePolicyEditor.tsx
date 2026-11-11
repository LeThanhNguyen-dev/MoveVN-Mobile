import type { ComponentRef } from "react";
import { Plus, Trash2 } from "lucide-react-native";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Switch, TextInput, View } from "react-native"
import AppText from "@/components/AppText";
import i18n from "@/i18n";
import type { VehicleSurchargePolicy } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type Props = {
  value: VehicleSurchargePolicy[];
  onChange: (value: VehicleSurchargePolicy[]) => void;
  onDescriptionFocus?: (input: ComponentRef<typeof TextInput>) => void;
  onDescriptionBlur?: (input: ComponentRef<typeof TextInput>) => void;
};

type PolicyPreset = Pick<VehicleSurchargePolicy, "name" | "calculationMethod" | "description">;

/** Preset name/description dịch tại thời điểm gọi để theo ngôn ngữ đang chọn. */
function policyPreset(type: VehicleSurchargePolicy["feeType"]): PolicyPreset {
  switch (type) {
    case "ExcessMileage":
      return {
        name: i18n.t("mobile:ownerVehicle.surcharge.preset.excessMileage"),
        calculationMethod: "PerKm",
        description: i18n.t("mobile:ownerVehicle.surcharge.presetDescription.excessMileage"),
      };
    case "LateReturn":
      return {
        name: i18n.t("mobile:ownerVehicle.surcharge.preset.lateReturn"),
        calculationMethod: "PerHour",
        description: i18n.t("mobile:ownerVehicle.surcharge.presetDescription.lateReturn"),
      };
    case "Cleaning":
      return {
        name: i18n.t("mobile:ownerVehicle.surcharge.preset.cleaning"),
        calculationMethod: "Fixed",
        description: i18n.t("mobile:ownerVehicle.surcharge.presetDescription.cleaning"),
      };
    case "Deodorization":
      return {
        name: i18n.t("mobile:ownerVehicle.surcharge.preset.deodorization"),
        calculationMethod: "Fixed",
        description: i18n.t("mobile:ownerVehicle.surcharge.presetDescription.deodorization"),
      };
    default:
      return {
        name: i18n.t("mobile:ownerVehicle.surcharge.preset.custom"),
        calculationMethod: "Fixed",
        description: "",
      };
  }
}

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
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const descriptionInputRefs = useRef<Record<number, ComponentRef<typeof TextInput> | null>>({});

  const feeTypeOptions = useMemo<{ value: VehicleSurchargePolicy["feeType"]; label: string }[]>(
    () => [
      { value: "ExcessMileage", label: t("mobile:ownerVehicle.surcharge.tag.excessMileage") },
      { value: "LateReturn", label: t("mobile:ownerVehicle.surcharge.tag.lateReturn") },
      { value: "Cleaning", label: t("mobile:ownerVehicle.surcharge.tag.cleaning") },
      { value: "Deodorization", label: t("mobile:ownerVehicle.surcharge.tag.deodorization") },
      { value: "Custom", label: t("mobile:ownerVehicle.surcharge.tag.custom") },
    ],
    [t],
  );

  const calculationOptions = useMemo<{ value: VehicleSurchargePolicy["calculationMethod"]; label: string }[]>(
    () => [
      { value: "PerKm", label: t("mobile:ownerVehicle.surcharge.calc.perKm") },
      { value: "PerHour", label: t("mobile:ownerVehicle.surcharge.calc.perHour") },
      { value: "PerDay", label: t("mobile:ownerVehicle.surcharge.calc.perDay") },
      { value: "Fixed", label: t("mobile:ownerVehicle.surcharge.calc.fixed") },
    ],
    [t],
  );

  function update(index: number, patch: Partial<VehicleSurchargePolicy>) {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addPolicy(type: VehicleSurchargePolicy["feeType"] = "ExcessMileage") {
    const preset = policyPreset(type);
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
          <AppText display style={styles.title}>{t("mobile:ownerVehicle.surcharge.title")}</AppText>
          <AppText style={styles.sub}>{t("mobile:ownerVehicle.surcharge.editorSubtitle")}</AppText>
        </View>
        <Pressable onPress={() => addPolicy()} style={styles.addBtn}>
          <Plus color={theme.onBrand} size={14} />
          <AppText style={styles.addText}>{t("mobile:ownerVehicle.surcharge.add")}</AppText>
        </Pressable>
      </View>

      {value.length === 0 ? <AppText style={styles.empty}>{t("mobile:ownerVehicle.surcharge.empty")}</AppText> : null}

      {value.map((policy, index) => (
        <View key={`${policy.id ?? "new"}-${index}`} style={[styles.card, !policy.isActive && styles.cardInactive]}>
          <View style={styles.rowBetween}>
            <AppText display style={styles.cardTitle}>{policy.name || t("mobile:ownerVehicle.surcharge.fallbackName")}</AppText>
            <View style={styles.actions}>
              <Switch value={policy.isActive} onValueChange={(checked) => update(index, { isActive: checked })} trackColor={{ false: theme.faint, true: theme.brand }} />
              <Pressable onPress={() => removePolicy(index)} style={styles.iconBtn}>
                <Trash2 color={theme.danger} size={15} />
              </Pressable>
            </View>
          </View>

          <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.feeTypeLabel")}</AppText>
          <View style={styles.chips}>
            {feeTypeOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  const preset = policyPreset(option.value);
                  update(index, { feeType: option.value, name: preset.name, description: preset.description, calculationMethod: preset.calculationMethod });
                }}
                style={[styles.chip, policy.feeType === option.value && styles.chipActive]}
              >
                <AppText style={[styles.chipText, policy.feeType === option.value && styles.chipTextActive]}>{option.label}</AppText>
              </Pressable>
            ))}
          </View>

          <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.nameLabel")}</AppText>
          <TextInput value={policy.name} onChangeText={(text) => update(index, { name: text })} style={styles.input} placeholderTextColor={theme.placeholder} />

          <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.calcLabel")}</AppText>
          <View style={styles.chips}>
            {calculationOptions.map((option) => (
              <Pressable key={option.value} onPress={() => update(index, { calculationMethod: option.value })} style={[styles.chip, policy.calculationMethod === option.value && styles.chipActive]}>
                <AppText style={[styles.chipText, policy.calculationMethod === option.value && styles.chipTextActive]}>{option.label}</AppText>
              </Pressable>
            ))}
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.unitPriceLabel")}</AppText>
              <TextInput
                value={numberText(policy.unitPrice)}
                onChangeText={(text) => update(index, { unitPrice: optionalNumber(text) ?? 0 })}
                keyboardType="numeric"
                placeholder={t("mobile:ownerVehicle.surcharge.unitPricePlaceholder")}
                placeholderTextColor={theme.placeholder}
                style={styles.input}
              />
            </View>
            <View style={styles.col}>
              <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.maxLabel")}</AppText>
              <TextInput
                value={numberText(policy.maxAmount)}
                onChangeText={(text) => update(index, { maxAmount: optionalNumber(text) })}
                keyboardType="numeric"
                placeholder={t("mobile:ownerVehicle.surcharge.optionalPlaceholder")}
                placeholderTextColor={theme.placeholder}
                style={styles.input}
              />
            </View>
          </View>

          {policy.feeType === "ExcessMileage" ? (
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.includedKmLabel")}</AppText>
                <TextInput
                  value={numberText(policy.includedKm)}
                  onChangeText={(text) => update(index, { includedKm: optionalNumber(text) })}
                  keyboardType="numeric"
                  placeholder={t("mobile:ownerVehicle.surcharge.includedKmPlaceholder")}
                  placeholderTextColor={theme.placeholder}
                  style={styles.input}
                />
              </View>
              <View style={styles.col}>
                <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.scopeLabel")}</AppText>
                <View style={styles.scopeRow}>
                  {(["PerBooking", "PerDay"] as const).map((scope) => (
                    <Pressable key={scope} onPress={() => update(index, { allowanceScope: scope })} style={[styles.scopeBtn, (policy.allowanceScope ?? "PerBooking") === scope && styles.scopeBtnActive]}>
                      <AppText style={[styles.scopeText, (policy.allowanceScope ?? "PerBooking") === scope && styles.scopeTextActive]}>
                        {scope === "PerDay"
                          ? t("mobile:ownerVehicle.surcharge.scope.day")
                          : t("mobile:ownerVehicle.surcharge.scope.booking")}
                      </AppText>
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
                  <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.graceHoursLabel")}</AppText>
                  <TextInput
                    value={hoursInputValue(resolveHours(policy.lateGraceHours, policy.lateGraceMinutes))}
                    onChangeText={(text) => {
                      const hours = parseHoursInput(text);
                      update(index, { lateGraceHours: hours, lateGraceMinutes: hours != null ? Math.round(hours * 60) : null });
                    }}
                    keyboardType="numeric"
                    placeholder={t("mobile:ownerVehicle.surcharge.graceHoursPlaceholder")}
                    placeholderTextColor={theme.placeholder}
                    style={styles.input}
                  />
                </View>
                <View style={styles.col}>
                  <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.dayThresholdLabel")}</AppText>
                  <TextInput
                    value={hoursInputValue(resolveHours(policy.lateDayThresholdHours, policy.lateDayThresholdMinutes))}
                    onChangeText={(text) => {
                      const hours = parseHoursInput(text);
                      update(index, { lateDayThresholdHours: hours, lateDayThresholdMinutes: hours != null ? Math.round(hours * 60) : null });
                    }}
                    keyboardType="numeric"
                    placeholder={t("mobile:ownerVehicle.surcharge.dayThresholdPlaceholder")}
                    placeholderTextColor={theme.placeholder}
                    style={styles.input}
                  />
                </View>
              </View>
              <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.lateDailyRateLabel")}</AppText>
              <TextInput value={numberText(policy.lateDailyRate)} onChangeText={(text) => update(index, { lateDailyRate: optionalNumber(text) })} keyboardType="numeric" style={styles.input} />
            </>
          ) : null}

          <AppText style={styles.label}>{t("mobile:ownerVehicle.surcharge.descriptionLabel")}</AppText>
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
