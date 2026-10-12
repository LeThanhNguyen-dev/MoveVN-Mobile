import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ExploreStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getPublicVehicleById } from "@/features/vehicles/services/publicVehicleService";
import type { VehicleResponse } from "@/features/vehicles/types";
import { getMinPrice } from "@/features/vehicles/ownerDisplay";
import { calculateRentalDays, formatPeriodSummary } from "@/features/vehicles/utils/rentalPeriod";
import AddressAutocomplete, {
  type SelectedAddress,
} from "@/features/locations/components/AddressAutocomplete";
import { createBooking } from "@/features/booking/bookingService";
import { formatDateTime, formatMoney } from "@/features/booking/utils/format";
import { getApiErrorMessage } from "@/services/apiClient";

type CreateRoute = RouteProp<ExploreStackParamList, "CreateBooking">;
type CreateNav = NativeStackNavigationProp<ExploreStackParamList, "CreateBooking">;

export default function CreateBookingScreen({
  route,
  navigation,
  onCreated,
}: {
  route: CreateRoute;
  navigation: CreateNav;
  onCreated?: (bookingId: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { vehicleId, startDate, endDate } = route.params;

  const [vehicle, setVehicle] = useState<VehicleResponse | null | undefined>(undefined);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [sameReturn, setSameReturn] = useState(true);
  const [returnAddress, setReturnAddress] = useState("");
  const [returnLat, setReturnLat] = useState<number | null>(null);
  const [returnLng, setReturnLng] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicVehicleById(vehicleId)
      .then((data) => {
        if (cancelled) return;
        setVehicle(data ?? null);
        if (data) {
          setPickupAddress(data.address);
          setPickupLat(data.latitude);
          setPickupLng(data.longitude);
        }
      })
      .catch(() => {
        if (!cancelled) setVehicle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const days = calculateRentalDays(startDate, endDate);
  const pricePerDay = vehicle ? getMinPrice(vehicle) : null;
  const estimate = pricePerDay != null && days > 0 ? pricePerDay * days : null;

  function handleSelectPickup(selected: SelectedAddress) {
    setPickupAddress(selected.address);
    setPickupLat(selected.latitude);
    setPickupLng(selected.longitude);
  }

  function handleSelectReturn(selected: SelectedAddress) {
    setReturnAddress(selected.address);
    setReturnLat(selected.latitude);
    setReturnLng(selected.longitude);
  }

  async function handleSubmit() {
    if (!pickupAddress.trim()) {
      Alert.alert("Thiếu địa điểm", "Vui lòng chọn địa chỉ nhận xe từ danh sách gợi ý.");
      return;
    }
    if (pickupLat == null || pickupLng == null) {
      Alert.alert("Thiếu tọa độ", "Địa chỉ nhận xe chưa ghim được tọa độ. Hãy chọn lại từ danh sách gợi ý.");
      return;
    }
    if (!sameReturn) {
      if (!returnAddress.trim()) {
        Alert.alert("Thiếu địa điểm", "Vui lòng chọn địa chỉ trả xe từ danh sách gợi ý.");
        return;
      }
      if (returnLat == null || returnLng == null) {
        Alert.alert("Thiếu tọa độ", "Địa chỉ trả xe chưa ghim được tọa độ. Hãy chọn lại từ danh sách gợi ý.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const created = await createBooking({
        vehicleId,
        startDate,
        endDate,
        pickupAddress: pickupAddress.trim(),
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLng,
        returnAddress: sameReturn ? undefined : returnAddress.trim(),
        returnLatitude: sameReturn ? undefined : returnLat ?? undefined,
        returnLongitude: sameReturn ? undefined : returnLng ?? undefined,
        customerNote: note.trim() || undefined,
        promotionCode: promoCode.trim() || undefined,
      });
      Alert.alert(
        "Đặt xe thành công",
        `Mã đơn ${created.bookingCode}. Chủ xe duyệt xong bạn sẽ thanh toán cọc.`,
        [{ text: "Xem chuyến đi", onPress: () => onCreated?.(created.id) }],
      );
    } catch (err) {
      Alert.alert("Không tạo được đơn", getApiErrorMessage(err, "Vui lòng thử lại sau."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          Xác nhận đặt xe
        </Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {vehicle === undefined ? (
          <ActivityIndicator color={theme.brand} />
        ) : vehicle === null ? (
          <Text style={styles.muted}>Không tải được thông tin xe.</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {[vehicle.brandName, vehicle.modelName, vehicle.year].filter(Boolean).join(" ")}
              </Text>
              <Text style={styles.muted}>{formatPeriodSummary(startDate, endDate)}</Text>
              <Text style={styles.muted}>
                {days > 0 ? `${days} ngày` : "Thời gian chưa hợp lệ"}
                {estimate != null ? ` · tạm tính ${formatMoney(estimate)}` : ""}
              </Text>
              <Text style={styles.hint}>Giá chính xác (cọc, phí, khuyến mãi) hiển thị sau khi tạo đơn.</Text>
            </View>

            <Text style={styles.label}>Nhận xe lúc: {formatDateTime(startDate)}</Text>
            <AddressAutocomplete
              label="Địa điểm nhận xe"
              value={pickupAddress}
              onChange={setPickupAddress}
              onSelect={handleSelectPickup}
              onManualChange={() => {
                setPickupLat(null);
                setPickupLng(null);
              }}
            />

            <View style={styles.switchRow}>
              <Text style={styles.label}>Trả xe tại điểm nhận</Text>
              <Switch value={sameReturn} onValueChange={setSameReturn} />
            </View>
            {!sameReturn && (
              <>
                <Text style={styles.label}>Trả xe lúc: {formatDateTime(endDate)}</Text>
                <AddressAutocomplete
                  label="Địa điểm trả xe"
                  value={returnAddress}
                  onChange={setReturnAddress}
                  onSelect={handleSelectReturn}
                  onManualChange={() => {
                    setReturnLat(null);
                    setReturnLng(null);
                  }}
                />
              </>
            )}

            <Text style={styles.label}>Ghi chú cho chủ xe</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Giờ giấc, nhu cầu đặc biệt..."
              placeholderTextColor={theme.placeholder}
              multiline
              style={[styles.input, styles.multiline]}
            />

            <Text style={styles.label}>Mã khuyến mãi (nếu có)</Text>
            <TextInput
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder="Nhập mã"
              placeholderTextColor={theme.placeholder}
              autoCapitalize="characters"
              style={styles.input}
            />

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [styles.submit, (submitting || pressed) && styles.submitDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color={theme.onBrand} />
              ) : (
                <Text style={styles.submitText}>Gửi yêu cầu thuê xe</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    body: { padding: 16, gap: 10, paddingBottom: 32 },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      gap: 4,
    },
    cardTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    muted: { color: theme.muted, fontSize: 13 },
    hint: { color: theme.placeholder, fontSize: 12, fontStyle: "italic" },
    label: { color: theme.text, fontSize: 13, fontWeight: "700", marginTop: 6 },
    input: {
      backgroundColor: theme.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
    },
    multiline: { minHeight: 70, textAlignVertical: "top" },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 6,
    },
    submit: {
      marginTop: 14,
      borderRadius: 12,
      backgroundColor: theme.brand,
      paddingVertical: 14,
      alignItems: "center",
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: theme.onBrand, fontSize: 16, fontWeight: "800" },
  });
