import { Star, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "@/components/AppText";
import type { ReviewResponse } from "@/features/review/reviewService";
import DetailSectionHeader from "./DetailSectionHeader";
import { detailFont, useDetailTheme } from "./detailTheme";

type Props = {
  reviews: ReviewResponse[];
  state: "loading" | "ready" | "error";
  average: number | null;
  onRetry: () => void;
  onOpenUserProfile?: (userId: number) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "K";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

function reviewDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("vi-VN");
}

function Stars({ value, size = 11 }: { value: number; size?: number }) {
  const { p } = useDetailTheme();
  return (
    <View style={staticStyles.stars}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          color={p.rating}
          fill={index < Math.round(value) ? p.rating : "transparent"}
          size={size}
          strokeWidth={2}
        />
      ))}
    </View>
  );
}

function ReviewCard({
  review,
  full = false,
  onOpenUserProfile,
}: {
  review: ReviewResponse;
  full?: boolean;
  onOpenUserProfile?: (userId: number) => void;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const name = review.reviewerName || "Khách thuê";
  const canOpen = Boolean(onOpenUserProfile && review.reviewerId);
  const nameNode = canOpen ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Xem hồ sơ ${name}`}
      onPress={() => onOpenUserProfile?.(review.reviewerId)}
    >
      <AppText style={styles.reviewName} numberOfLines={1}>
        {name}
      </AppText>
    </Pressable>
  ) : (
    <AppText style={styles.reviewName} numberOfLines={1}>
      {name}
    </AppText>
  );

  return (
    <View style={[styles.review, full && styles.reviewFull]}>
      <View style={styles.reviewHead}>
        <View style={styles.reviewAvatar}>
          <AppText style={styles.reviewAvatarText}>{initials(name)}</AppText>
        </View>
        <View style={styles.reviewWho}>
          {nameNode}
          <AppText style={styles.reviewDate}>{reviewDate(review.createdAt)}</AppText>
        </View>
        <Stars value={review.rating} />
      </View>
      <AppText style={styles.reviewComment} numberOfLines={full ? undefined : 4}>
        {review.comment?.trim() || "Khách thuê không để lại nhận xét."}
      </AppText>
    </View>
  );
}

export default function VehicleReviewsSection({
  reviews,
  state,
  average,
  onRetry,
  onOpenUserProfile,
}: Props) {
  const { p, mode } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const insets = useSafeAreaInsets();
  const [allOpen, setAllOpen] = useState(false);

  const count = reviews.length;
  const distribution = [5, 4, 3, 2, 1].map((score) => {
    const total = reviews.filter((review) => Math.round(review.rating) === score).length;
    return { score, total, percent: count > 0 ? (total / count) * 100 : 0 };
  });

  return (
    <View style={styles.section}>
      <View style={styles.headWrap}>
        <DetailSectionHeader
          actionLabel={count > 0 ? "Xem tất cả" : undefined}
          actionAccessibilityLabel={`Xem tất cả ${count} đánh giá`}
          icon={Star}
          onAction={count > 0 ? () => setAllOpen(true) : undefined}
          title="Đánh giá từ khách thuê"
          tone="amber"
        />
        <AppText style={styles.headSub}>
          {state === "ready" && count > 0 ? `${count} lượt đánh giá` : "Chia sẻ từ người thuê trước"}
        </AppText>
      </View>

      {state === "loading" ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={p.brand} size="small" />
          <AppText style={styles.stateText}>Đang tải đánh giá…</AppText>
        </View>
      ) : state === "error" ? (
        <View style={styles.stateCard}>
          <AppText style={styles.stateText}>Không tải được đánh giá.</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Thử lại đánh giá" onPress={onRetry}>
            <AppText style={styles.retry}>Thử lại</AppText>
          </Pressable>
        </View>
      ) : count === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Star color={p.rating} size={20} strokeWidth={2} />
          </View>
          <AppText style={styles.emptyTitle}>Chưa có đánh giá</AppText>
          <AppText style={styles.emptyText}>Xe chưa có đánh giá từ khách thuê.</AppText>
        </View>
      ) : (
        <>
          <View style={styles.ratingCard}>
            <View style={styles.scoreBlock}>
              <AppText style={styles.score}>{average != null ? average.toFixed(1) : "—"}</AppText>
              <Stars value={average ?? 0} size={12} />
              <AppText style={styles.scoreCount}>{count} đánh giá</AppText>
            </View>
            <View style={styles.bars}>
              {distribution.map((item) => (
                <View key={item.score} style={styles.barRow}>
                  <AppText style={styles.barLabel}>{item.score}</AppText>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${item.percent}%` as `${number}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.strip}
            decelerationRate="fast"
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={261}
          >
            {reviews.slice(0, 6).map((review) => (
              <ReviewCard
                key={review.id}
                onOpenUserProfile={onOpenUserProfile}
                review={review}
              />
            ))}
          </ScrollView>
        </>
      )}

      <Modal animationType="slide" onRequestClose={() => setAllOpen(false)} visible={allOpen}>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <View style={styles.modal}>
          <View style={[styles.modalHead, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.modalTitleWrap}>
              <AppText style={styles.modalTitle}>Đánh giá từ khách thuê</AppText>
              <AppText style={styles.modalSub}>{count} lượt đánh giá</AppText>
            </View>
            <Pressable
              accessibilityLabel="Đóng đánh giá"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setAllOpen(false)}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <X color={p.ink} size={20} strokeWidth={2.2} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.modalContent,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {reviews.map((review) => (
              <ReviewCard
                full
                key={review.id}
                onOpenUserProfile={onOpenUserProfile}
                review={review}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const staticStyles = StyleSheet.create({
  stars: { flexDirection: "row", alignItems: "center", gap: 1 },
});

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"]) =>
  StyleSheet.create({
    section: { marginTop: 22 },
    headWrap: { marginHorizontal: 20, gap: 3 },
    headSub: { color: p.muted, fontFamily: detailFont.regular, fontSize: 10.5 },
    stateCard: {
      marginTop: 11,
      marginHorizontal: 14,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    stateText: { color: p.muted, fontFamily: detailFont.regular, fontSize: 12, flexShrink: 1 },
    retry: { color: p.brand, fontFamily: detailFont.bold, fontSize: 11.5 },
    emptyCard: {
      marginTop: 11,
      marginHorizontal: 14,
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surface,
      alignItems: "center",
      gap: 5,
    },
    emptyIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.ratingSoft,
    },
    emptyTitle: { color: p.ink, fontFamily: detailFont.bold, fontSize: 13 },
    emptyText: { color: p.muted, fontFamily: detailFont.regular, fontSize: 11, textAlign: "center" },
    ratingCard: {
      marginTop: 11,
      marginHorizontal: 14,
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: p.ratingBorder,
      backgroundColor: p.ratingSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    scoreBlock: { alignItems: "center", width: 76 },
    score: {
      color: p.ink,
      fontFamily: detailFont.display,
      fontSize: 28,
      lineHeight: 32,
      letterSpacing: -1,
    },
    scoreCount: { color: p.muted, fontFamily: detailFont.regular, fontSize: 9, marginTop: 3 },
    bars: { flex: 1, gap: 4 },
    barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    barLabel: {
      color: p.muted,
      fontFamily: detailFont.medium,
      fontSize: 9,
      width: 8,
      textAlign: "right",
    },
    barTrack: { flex: 1, height: 4, borderRadius: 999, overflow: "hidden", backgroundColor: p.ratingBorder },
    barFill: { height: 4, borderRadius: 999, backgroundColor: p.rating },
    strip: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 9 },
    review: {
      width: 252,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surface,
    },
    reviewFull: { width: "100%" },
    reviewHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    reviewAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.brandSoft,
    },
    reviewAvatarText: { color: p.brand, fontFamily: detailFont.extraBold, fontSize: 9.5 },
    reviewWho: { flex: 1, minWidth: 0 },
    reviewName: { color: p.ink, fontFamily: detailFont.bold, fontSize: 11 },
    reviewDate: { color: p.faint, fontFamily: detailFont.regular, fontSize: 9, marginTop: 1 },
    reviewComment: {
      color: p.muted,
      fontFamily: detailFont.regular,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 8,
    },
    modal: { flex: 1, backgroundColor: p.canvas },
    modalHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 18,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.line,
    },
    modalTitleWrap: { flex: 1, minWidth: 0 },
    modalTitle: { color: p.ink, fontFamily: detailFont.display, fontSize: 17 },
    modalSub: { color: p.muted, fontFamily: detailFont.regular, fontSize: 10.5, marginTop: 2 },
    close: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surface,
    },
    modalContent: { padding: 14, gap: 9 },
    pressed: { opacity: 0.65 },
  });
