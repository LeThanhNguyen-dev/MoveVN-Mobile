import { useState } from "react";
import { Image } from "expo-image";
import {
  ArrowRight,
  CalendarCheck,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  Search,
  ShieldCheck,
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import BrandButton from "@/components/ui/BrandButton";
import { useTheme } from "@/theme/useTheme";

const steps = [
  {
    icon: Search,
    title: "Tìm chiếc xe phù hợp",
    description: "Chọn địa điểm, thời gian và loại xe cho chuyến đi của bạn.",
  },
  {
    icon: ClipboardCheck,
    title: "Kiểm tra thông tin",
    description: "Xem giá thuê, tiền cọc, giấy tờ và điều kiện nhận xe.",
  },
  {
    icon: FileCheck2,
    title: "Gửi yêu cầu đặt xe",
    description: "Đăng nhập, gửi yêu cầu và theo dõi xác nhận từ chủ xe.",
  },
  {
    icon: CalendarCheck,
    title: "Nhận xe & bắt đầu",
    description: "Kiểm tra, xác nhận bàn giao và tận hưởng chuyến đi.",
  },
];
const benefits = [
  {
    icon: CalendarCheck,
    title: "Chủ động lịch cho thuê",
    description: "Quản lý lịch thuê và những ngày xe cần nghỉ.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Quản lý yêu cầu tập trung",
    description: "Theo dõi, xác nhận và hỗ trợ khách trên ứng dụng.",
  },
  {
    icon: ShieldCheck,
    title: "Thông tin giá rõ ràng",
    description: "Cập nhật giá, mô tả và hình ảnh của xe.",
  },
];

export default function MobilityGuideScreen({
  owner = false,
  registeredOwner = false,
  onSearch,
  onBecomeOwner,
  onShowOwners,
}: {
  owner?: boolean;
  registeredOwner?: boolean;
  onSearch: () => void;
  onBecomeOwner: () => void;
  onShowOwners: () => void;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(true);
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <View style={styles.heading}>
        <AppText style={[styles.eyebrow, { color: theme.brand }]}>
          {owner ? "ĐỒNG HÀNH CÙNG MOVEVN" : "CÁCH HOẠT ĐỘNG"}
        </AppText>
        <AppText display style={[styles.title, { color: theme.text }]}>
          {owner ? "Xe rảnh hôm nay." : "Thuê xe,"}
          {"\n"}
          <AppText display style={{ color: theme.brand }}>
            {owner ? "Thêm thu nhập ngày mai." : "thật đơn giản."}
          </AppText>
        </AppText>
        <AppText style={[styles.body, { color: theme.muted }]}>
          {owner
            ? "Đăng xe và quản lý cho thuê ngay trên điện thoại."
            : "Từ tìm xe đến nhận xe trong 4 bước rõ ràng."}
        </AppText>
      </View>
      <Image
        source={
          owner
            ? require("../../../../assets/experience/owner-car.webp")
            : require("../../../../public/images/faq-promo-owner.jpg")
        }
        contentFit="cover"
        contentPosition={{ left: owner ? "65%" : "50%", top: "50%" }}
        style={styles.photo}
        accessibilityLabel={
          owner ? "Xe cho thuê trên hành trình" : "Hành trình cùng MoveVN"
        }
      />
      {owner ? (
        <>
          <View style={styles.benefits}>
            {benefits.map(({ icon: Icon, title, description }) => (
              <View key={title} style={styles.benefit}>
                <View
                  style={[
                    styles.benefitIcon,
                    { backgroundColor: theme.brandSoft },
                  ]}
                >
                  <Icon color={theme.brand} size={25} />
                </View>
                <View style={styles.flex}>
                  <AppText style={[styles.label, { color: theme.text }]}>
                    {title}
                  </AppText>
                  <AppText style={[styles.body, { color: theme.muted }]}>
                    {description}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
          <View
            style={[
              styles.requirements,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpanded(!expanded)}
              style={styles.requirementsTitle}
            >
              <FileCheck2 size={22} color={theme.brand} />
              <AppText
                style={[styles.flex, styles.label, { color: theme.text }]}
              >
                Điều kiện đăng ký
              </AppText>
              <ChevronDown
                color={theme.text}
                size={18}
                style={{
                  transform: [{ rotate: expanded ? "180deg" : "0deg" }],
                }}
              />
            </Pressable>
            {expanded && (
              <View style={{ gap: 10 }}>
                {[
                  "Tài khoản và liên hệ hợp lệ",
                  "Hoàn tất xác thực theo yêu cầu",
                  "Thông tin, hình ảnh và giá thuê rõ ràng",
                ].map((text) => (
                  <View key={text} style={styles.check}>
                    <Check size={17} color={theme.brand} />
                    <AppText
                      style={[styles.body, styles.flex, { color: theme.muted }]}
                    >
                      {text}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </View>
          <AppText display style={[styles.sectionTitle, { color: theme.text }]}>
            Bắt đầu với 3 bước
          </AppText>
          <View style={styles.onboarding}>
            {["Tạo tài khoản", "Xác thực thông tin", "Đăng xe cho thuê"].map(
              (text, index) => (
                <View key={text} style={styles.onboardingStep}>
                  <View
                    style={[
                      styles.number,
                      { backgroundColor: theme.brandSoft },
                    ]}
                  >
                    <AppText
                      style={{
                        color: theme.brand,
                        fontSize: 19,
                        fontWeight: "700",
                      }}
                    >
                      {index + 1}
                    </AppText>
                  </View>
                  <AppText style={[styles.caption, { color: theme.text }]}>
                    {text}
                  </AppText>
                  {index < 2 && (
                    <ArrowRight
                      size={16}
                      color={theme.faint}
                      style={styles.stepArrow}
                    />
                  )}
                </View>
              ),
            )}
          </View>
          <BrandButton
            title={registeredOwner ? "Thêm xe vào đội" : "Đăng ký chủ xe"}
            onPress={onBecomeOwner}
            icon={<ArrowRight color="white" size={18} />}
          />
        </>
      ) : (
        <>
          <View style={styles.timeline}>
            {steps.map(({ icon: Icon, title, description }, index) => (
              <View key={title} style={styles.step}>
                <View style={styles.rail}>
                  {index < steps.length - 1 && (
                    <View
                      style={[
                        styles.connector,
                        { borderColor: theme.brandBorder },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.stepIcon,
                      { backgroundColor: theme.brandSoft },
                    ]}
                  >
                    <Icon color={theme.brand} size={26} />
                  </View>
                </View>
                <View style={[styles.flex, { paddingTop: 1 }]}>
                  <AppText
                    style={{
                      color: theme.brand,
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </AppText>
                  <AppText
                    display
                    style={[styles.stepTitle, { color: theme.text }]}
                  >
                    {title}
                  </AppText>
                  <AppText style={[styles.body, { color: theme.muted }]}>
                    {description}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
          <BrandButton
            title="Bắt đầu tìm xe"
            onPress={onSearch}
            icon={<ArrowRight color="white" size={18} />}
          />
          <Pressable
            accessibilityRole="button"
            onPress={onShowOwners}
            style={styles.ownerLink}
          >
            <AppText style={[styles.body, { color: theme.text }]}>
              Bạn là chủ xe?{" "}
              <AppText style={{ color: theme.brand, fontWeight: "700" }}>
                Tìm hiểu thêm →
              </AppText>
            </AppText>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 22,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  heading: { gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { fontSize: 29, lineHeight: 39, fontWeight: "700" },
  body: { fontSize: 13, lineHeight: 21 },
  photo: { width: "100%", aspectRatio: 1.65, borderRadius: 18 },
  flex: { flex: 1, minWidth: 0 },
  timeline: { gap: 0 },
  step: { flexDirection: "row", gap: 16, minHeight: 120 },
  rail: { width: 54, alignItems: "center" },
  stepIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
  },
  connector: {
    position: "absolute",
    top: 60,
    bottom: 6,
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
  },
  stepTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  ownerLink: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  benefits: { gap: 22 },
  benefit: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontWeight: "700" },
  requirements: { padding: 16, borderWidth: 1, borderRadius: 18, gap: 16 },
  requirementsTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
  check: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  onboarding: { flexDirection: "row", gap: 14 },
  onboardingStep: { flex: 1, alignItems: "center", gap: 10 },
  number: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  caption: { textAlign: "center", fontSize: 11, lineHeight: 17 },
  stepArrow: { position: "absolute", right: -15, top: 12 },
});
