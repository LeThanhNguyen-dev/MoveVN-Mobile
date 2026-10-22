import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { getPublicUserProfile, type PublicUserProfile } from "../services/publicUserProfileService";
import { BookingButton, BookingCard, BookingHeader } from "@/features/booking/components/BookingControls";
import { formatMoney } from "@/features/booking/utils/format";

export default function PublicUserProfileScreen({ userId, onBack, onViewVehicle }: { userId: number; onBack: () => void; onViewVehicle: (id: number) => void }) {
  const { theme } = useTheme();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null), [error, setError] = useState(""), [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true; setError(""); setProfile(null);
    getPublicUserProfile(userId).then(data => { if (alive) setProfile(data); }).catch(err => { if (alive) setError(getApiErrorMessage(err, "Chưa tải được hồ sơ công khai.")); });
    return () => { alive = false; };
  }, [userId, revision]);
  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <BookingHeader title="Hồ sơ công khai" onBack={onBack} />
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      {!!error && <><Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text><BookingButton title="Thử lại" onPress={() => setRevision(value => value + 1)} /></>}
      {!error && !profile && <ActivityIndicator color={theme.brand} />}
      {profile && <>
        <BookingCard>
          {!!profile.avatarUrl && <Image source={{ uri: profile.avatarUrl }} style={{ width: 80, height: 80, borderRadius: 40 }} />}
          <Text style={{ color: theme.text, fontWeight: "700", fontSize: 22 }}>{profile.fullName}</Text>
          <Text style={{ color: theme.muted }}>{profile.isOwner ? "Chủ xe" : "Khách thuê"}{profile.isVerified ? " · Đã xác minh" : ""}{profile.tier ? ` · ${profile.tier}` : ""}</Text>
          <Text style={{ color: theme.text }}>{profile.totalTrips} chuyến · {profile.averageRating ?? "Chưa có"}/5 · {profile.totalReviews} đánh giá</Text>
          <Text style={{ color: theme.muted }}>Tham gia {new Date(profile.createdAt).toLocaleDateString("vi-VN")}</Text>
        </BookingCard>
        {profile.vehicles.map(vehicle => <BookingCard key={vehicle.id}>
          <Text style={{ color: theme.text, fontWeight: "700" }}>{vehicle.brandName} {vehicle.modelName} {vehicle.variantName}</Text>
          <Text style={{ color: theme.muted }}>{vehicle.address} · {formatMoney(vehicle.pricePerDay)}/ngày</Text>
          <BookingButton secondary title="Xem chi tiết xe" onPress={() => onViewVehicle(vehicle.id)} />
        </BookingCard>)}
        {profile.reviews.map(review => <BookingCard key={review.id}>
          <Text style={{ color: theme.text, fontWeight: "700" }}>{review.reviewerName} · {review.rating}/5</Text>
          {!!review.comment && <Text style={{ color: theme.text }}>{review.comment}</Text>}
        </BookingCard>)}
      </>}
    </ScrollView>
  </View>;
}
