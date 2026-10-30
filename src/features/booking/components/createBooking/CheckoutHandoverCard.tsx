import { CircleAlert, CircleCheck, IdCard, MapPin, Repeat2, TriangleAlert } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Switch, TextInput, View } from "react-native";
import AppText from "@/components/AppText";
import AddressAutocomplete, {
  type SelectedAddress,
} from "@/features/locations/components/AddressAutocomplete";
import { formatMoney } from "@/features/booking/utils/format";
import type { DeliveryConfig, DeliveryPreview } from "@/features/booking/utils/bookingPricing";
import { checkoutFont, useCheckoutTheme } from "./checkoutTheme";
import CheckoutSectionHeader from "./CheckoutSectionHeader";

type Props = {
  pickupAddress: string;
  pickupUnpinned: boolean;
  onChangePickup: (value: string) => void;
  onSelectPickup: (address: SelectedAddress) => void;
  onManualPickup: () => void;
  onFocusPickup: () => void;
  deliveryPreview: DeliveryPreview | null;
  config: DeliveryConfig;
  sameReturn: boolean;
  onToggleSameReturn: (value: boolean) => void;
  returnAddress: string;
  returnUnpinned: boolean;
  onChangeReturn: (value: string) => void;
  onSelectReturn: (address: SelectedAddress) => void;
  onManualReturn: () => void;
  onFocusReturn: () => void;
  note: string;
  onChangeNote: (value: string) => void;
  onFocusNote: () => void;
};

export default function CheckoutHandoverCard({
  pickupAddress,
  pickupUnpinned,
  onChangePickup,
  onSelectPickup,
  onManualPickup,
  onFocusPickup,
  deliveryPreview,
  config,
  sameReturn,
  onToggleSameReturn,
  returnAddress,
  returnUnpinned,
  onChangeReturn,
  onSelectReturn,
  onManualReturn,
  onFocusReturn,
  note,
  onChangeNote,
  onFocusNote,
}: Props) {
  const { p } = useCheckoutTheme();
  const styles = useMemo(() => createStyles(p), [p]);

  let deliveryLine: { tone: "muted" | "mint" | "danger"; text: string } | null = null;
  if (deliveryPreview) {
    if (deliveryPreview.overMax) {
      deliveryLine = {
        tone: "danger",
        text: `Cách xe ${deliveryPreview.distanceKm} km, vượt quá phạm vi giao xe ${config.maxKm} km.`,
      };
    } else if (deliveryPreview.fee > 0) {
      deliveryLine = {
        tone: "muted",
        text: `Cách xe ${deliveryPreview.distanceKm} km · phí giao ${formatMoney(deliveryPreview.fee)}`,
      };
    } else {
      deliveryLine = {
        tone: "mint",
        text: `Cách xe ${deliveryPreview.distanceKm} km · miễn phí giao trong ${config.freeKm} km`,
      };
    }
  }

  return (
    <View style={styles.card}>
      <CheckoutSectionHeader
        icon={Repeat2}
        subtitle="Địa điểm bàn giao xe"
        title="Nhận & trả xe"
      />

      <View style={styles.block}>
        <AppText style={styles.blockTitle}>Điểm nhận xe</AppText>
        <AddressAutocomplete
          onChange={onChangePickup}
          onFocusInput={onFocusPickup}
          onManualChange={onManualPickup}
          onSelect={onSelectPickup}
          placeholder="Tìm địa chỉ nhận xe"
          showLabel={false}
          value={pickupAddress}
        />

        {pickupAddress.trim() && pickupUnpinned ? (
          <View style={styles.noteRow}>
            <TriangleAlert color={p.warning} size={14} strokeWidth={2.1} />
            <AppText style={styles.noteText}>
              Chọn địa chỉ từ danh sách gợi ý để xác định khoảng cách giao xe.
            </AppText>
          </View>
        ) : null}

        {deliveryLine ? (
          <View
            style={[
              styles.delivery,
              deliveryLine.tone === "danger" && styles.deliveryDanger,
              deliveryLine.tone === "mint" && styles.deliveryMint,
            ]}
          >
            {deliveryLine.tone === "danger" ? (
              <CircleAlert color={p.danger} size={14} strokeWidth={2.1} />
            ) : deliveryLine.tone === "mint" ? (
              <CircleCheck color={p.mint} size={14} strokeWidth={2.1} />
            ) : (
              <MapPin color={p.muted} size={14} strokeWidth={2.1} />
            )}
            <AppText
              style={[
                styles.deliveryText,
                deliveryLine.tone === "danger" && { color: p.danger },
                deliveryLine.tone === "mint" && { color: p.mint },
              ]}
            >
              {deliveryLine.text}
            </AppText>
          </View>
        ) : (
          <AppText style={styles.hint}>Chủ xe chỉ nhận giao trong bán kính {config.maxKm} km.</AppText>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.block}>
        <View style={styles.switchRow}>
          <View style={styles.switchBody}>
            <AppText style={styles.switchTitle}>Trả xe tại điểm nhận</AppText>
            <AppText style={styles.switchHint}>
              {sameReturn ? "Bạn sẽ trả xe đúng nơi đã nhận." : "Chọn địa chỉ trả xe bên dưới."}
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Trả xe tại điểm nhận"
            ios_backgroundColor={p.surfaceAlt}
            onValueChange={onToggleSameReturn}
            thumbColor="#FFFFFF"
            trackColor={{ false: p.surfaceAlt, true: p.brand }}
            value={sameReturn}
          />
        </View>

        {sameReturn ? (
          <View style={styles.sameBox}>
            <AppText style={styles.sameLabel}>Địa điểm trả</AppText>
            <AppText style={styles.sameValue} numberOfLines={2}>
              {pickupAddress.trim() || "Chưa chọn điểm nhận xe"}
            </AppText>
          </View>
        ) : (
          <>
            <AddressAutocomplete
              onChange={onChangeReturn}
              onFocusInput={onFocusReturn}
              onManualChange={onManualReturn}
              onSelect={onSelectReturn}
              placeholder="Tìm địa chỉ trả xe"
              showLabel={false}
              value={returnAddress}
            />
            {returnAddress.trim() && returnUnpinned ? (
              <View style={styles.noteRow}>
                <TriangleAlert color={p.warning} size={14} strokeWidth={2.1} />
                <AppText style={styles.noteText}>
                  Chọn địa chỉ trả xe từ danh sách gợi ý để xác nhận vị trí.
                </AppText>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.block}>
        <View style={styles.noteHead}>
          <AppText style={styles.blockTitle}>Ghi chú cho chủ xe</AppText>
          <AppText style={styles.optional}>Không bắt buộc</AppText>
        </View>
        <TextInput
          accessibilityLabel="Ghi chú cho chủ xe"
          multiline
          onChangeText={onChangeNote}
          onFocus={onFocusNote}
          placeholder="Ví dụ: tôi đến sớm 15 phút, cần giao xe tận nơi…"
          placeholderTextColor={p.faint}
          selectionColor={p.brand}
          style={styles.input}
          textAlignVertical="top"
          value={note}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.notice}>
        <View style={styles.noticeIcon}>
          <IdCard color={p.warning} size={16} strokeWidth={2.1} />
        </View>
        <View style={styles.noticeBody}>
          <AppText style={styles.noticeTitle}>Lưu ý khi nhận xe</AppText>
          <AppText style={styles.noticeText}>
            Quý khách vui lòng mang theo CCCD và GPLX bản gốc để Chủ xe đối chiếu trực tiếp khi nhận xe. Xin cảm ơn!
          </AppText>
        </View>
      </View>
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useCheckoutTheme>["p"]) =>
  StyleSheet.create({
    card: {
      backgroundColor: p.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: p.line,
      padding: 16,
      gap: 13,
      shadowColor: p.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    block: { gap: 10 },
    blockTitle: { color: p.ink, fontFamily: checkoutFont.semibold, fontSize: 12.5 },
    divider: { height: 1, backgroundColor: p.line },
    noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    noteText: {
      color: p.warning,
      fontFamily: checkoutFont.medium,
      fontSize: 10.5,
      lineHeight: 15,
      flex: 1,
    },
    delivery: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surfaceSoft,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    deliveryMint: { borderColor: p.mintBorder, backgroundColor: p.mintSoft },
    deliveryDanger: { borderColor: p.dangerBorder, backgroundColor: p.dangerSoft },
    deliveryText: { color: p.muted, fontFamily: checkoutFont.medium, fontSize: 10.5, flex: 1 },
    hint: { color: p.faint, fontFamily: checkoutFont.regular, fontSize: 10, lineHeight: 14 },
    switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    switchBody: { flex: 1, minWidth: 0 },
    switchTitle: { color: p.ink, fontFamily: checkoutFont.semibold, fontSize: 13, lineHeight: 18 },
    switchHint: { color: p.muted, fontFamily: checkoutFont.regular, fontSize: 10, lineHeight: 14, marginTop: 1 },
    sameBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surfaceSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
    },
    sameLabel: {
      color: p.faint,
      fontFamily: checkoutFont.bold,
      fontSize: 8.5,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    sameValue: { color: p.ink, fontFamily: checkoutFont.medium, fontSize: 11.5, lineHeight: 16 },
    noteHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    optional: { color: p.faint, fontFamily: checkoutFont.regular, fontSize: 9.5 },
    input: {
      minHeight: 84,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surfaceSoft,
      paddingHorizontal: 12,
      paddingTop: 11,
      paddingBottom: 11,
      color: p.ink,
      fontFamily: checkoutFont.regular,
      fontSize: 12.5,
      lineHeight: 18,
    },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.warningBorder,
      backgroundColor: p.warningSoft,
      padding: 12,
    },
    noticeIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surface,
    },
    noticeBody: { flex: 1, minWidth: 0, gap: 3 },
    noticeTitle: { color: p.ink, fontFamily: checkoutFont.semibold, fontSize: 11.5 },
    noticeText: { color: p.muted, fontFamily: checkoutFont.regular, fontSize: 10.5, lineHeight: 16 },
  });
