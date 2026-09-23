import { useMemo, useState } from "react";
import { Alert, Linking } from "react-native";
import { ArrowLeft, ChevronDown, FileText, Headphones, Mail, MessageSquare, Phone } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PolicyDetailScreen from "@/features/cms/screens/PolicyDetailScreen";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const faqs = [
  {
    question: "Làm thế nào để đăng ký tài khoản?",
    answer:
      "Bạn có thể đăng ký bằng số điện thoại hoặc email, hoặc đăng nhập nhanh qua tài khoản Google. Sau khi đăng ký, bạn cần xác thực email/SĐT qua mã OTP để kích hoạt tài khoản.",
  },
  {
    question: "Làm thế nào để đặt xe?",
    answer:
      "Sau khi đăng nhập, bạn chọn xe mong muốn, chọn ngày giờ nhận/trả xe, điền địa điểm và gửi yêu cầu. Chủ xe sẽ phê duyệt hoặc từ chối yêu cầu của bạn.",
  },
  {
    question: "Tôi cần thanh toán những gì khi đặt xe?",
    answer:
      "Bạn cần thanh toán tiền cọc (deposit) theo tỷ lệ phần trăm do Chủ Xe quy định. Phần còn lại thường được thanh toán sau hoặc theo thỏa thuận với Chủ Xe. Phí nền tảng MoveVN sẽ được tính vào tổng số tiền.",
  },
  {
    question: "Làm thế nào để trở thành Chủ Xe?",
    answer:
      "Đăng nhập tài khoản, vào mục Đăng ký chủ xe, hoàn tất xác thực CCCD/CMND, cung cấp thông tin tài khoản ngân hàng, đăng ký thông tin xe và chờ MoveVN kiểm duyệt.",
  },
  {
    question: "Tôi cần hỗ trợ về một booking đang xử lý?",
    answer:
      "Sau khi đăng nhập, bạn có thể tạo ticket trong khu vực Hỗ trợ của tài khoản. Ngoài ra có thể gọi hotline hoặc gửi email để được hỗ trợ nhanh chóng.",
  },
  {
    question: "Làm thế nào để khiếu nại hoặc báo cáo vấn đề?",
    answer:
      "Bạn có thể mở yêu cầu giải quyết tranh chấp (dispute) từ trang chi tiết booking trong tài khoản, cung cấp bằng chứng và mô tả chi tiết. Nhân viên MoveVN sẽ điều tra và xử lý.",
  },
  {
    question: "Tôi quên mật khẩu, làm thế nào để lấy lại?",
    answer:
      "Tại trang đăng nhập, chọn Quên mật khẩu và làm theo hướng dẫn. Bạn sẽ nhận được mã OTP qua email để đặt lại mật khẩu mới.",
  },
  {
    question: "Chính sách hủy đặt xe như thế nào?",
    answer:
      "Chính sách hủy được áp dụng theo tầng (tiered cancellation policy). Tùy vào thời điểm hủy, bạn có thể được hoàn tiền một phần hoặc toàn bộ tiền cọc. Xem chi tiết tại Điều khoản sử dụng.",
  },
];

export default function SupportCenterScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showTerms, setShowTerms] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (showTerms) {
    return <PolicyDetailScreen slug="terms-of-service" onBack={() => setShowTerms(false)} />;
  }

  function handleTicketPress() {
    Alert.alert(
      "Ticket hỗ trợ",
      "Vui lòng liên hệ hotline 1900 6868 hoặc email movevn.noreply@gmail.com để tạo và theo dõi ticket.",
      [{ text: "Đã hiểu" }],
    );
  }

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.topBarTitle}>Trung tâm hỗ trợ</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Hỗ trợ</Text>
          <Text style={styles.title}>
            Cần giúp đỡ với <Text style={styles.titleAccent}>việc thuê xe</Text>?
          </Text>
          <Text style={styles.description}>
            MoveVN luôn sẵn sàng hỗ trợ bạn qua nhiều kênh liên hệ. Dưới đây là các câu hỏi thường gặp và
            thông tin liên hệ.
          </Text>
        </View>

        <View style={styles.contactGrid}>
          <Pressable
            accessibilityRole="button"
            onPress={() => { void Linking.openURL("mailto:movevn.noreply@gmail.com"); }}
            style={styles.contactCard}
          >
            <Mail color={theme.brand} size={26} strokeWidth={2.2} />
            <Text style={styles.contactTitle}>Email</Text>
            <Text style={styles.contactValue}>movevn.noreply@gmail.com</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => { void Linking.openURL("tel:19006868"); }}
            style={styles.contactCard}
          >
            <Phone color={theme.brand} size={26} strokeWidth={2.2} />
            <Text style={styles.contactTitle}>Hotline</Text>
            <Text style={styles.contactValue}>1900 6868</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleTicketPress} style={styles.contactCard}>
            <MessageSquare color={theme.brand} size={26} strokeWidth={2.2} />
            <Text style={styles.contactTitle}>Ticket hỗ trợ</Text>
            <Text style={styles.contactValue}>Tạo và theo dõi ticket.</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowTerms(true)}
            style={styles.contactCard}
          >
            <FileText color={theme.brand} size={26} strokeWidth={2.2} />
            <Text style={styles.contactTitle}>Điều khoản</Text>
            <Text style={styles.contactValue}>Xem Điều khoản sử dụng.</Text>
          </Pressable>
        </View>

        <View style={styles.faqHeader}>
          <Headphones color={theme.brand} size={20} strokeWidth={2.3} />
          <Text style={styles.faqTitle}>Câu hỏi thường gặp</Text>
        </View>

        <View style={styles.faqCard}>
          {faqs.map((faq, index) => {
            const expanded = expandedIndex === index;
            return (
              <View key={faq.question}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpandedIndex(expanded ? null : index)}
                  style={styles.faqRow}
                >
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <ChevronDown
                    color={theme.muted}
                    size={18}
                    strokeWidth={2.3}
                    style={expanded ? styles.chevronOpen : null}
                  />
                </Pressable>
                {expanded ? <Text style={styles.faqAnswer}>{faq.answer}</Text> : null}
                {index < faqs.length - 1 ? <View style={styles.faqDivider} /> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { flex: 1 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 4,
      minHeight: 48,
    },
    backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    topBarTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
    topBarSpacer: { width: 40 },
    scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 16 },
    header: { gap: 8, paddingTop: 2 },
    eyebrow: { color: theme.brand, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
    title: { color: theme.text, fontSize: 24, lineHeight: 32, fontWeight: "800" },
    titleAccent: { color: theme.brand },
    description: { color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
    contactGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    contactCard: {
      width: "48%",
      flexGrow: 1,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 8,
    },
    contactTitle: { color: theme.text, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
    contactValue: { color: theme.muted, fontSize: 12, lineHeight: 17, fontWeight: "600" },
    faqHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    faqTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    faqCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    faqRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13 },
    faqQuestion: { flex: 1, color: theme.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
    chevronOpen: { transform: [{ rotate: "180deg" }] },
    faqAnswer: { color: theme.muted, fontSize: 13, lineHeight: 21, fontWeight: "500", paddingBottom: 13 },
    faqDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
  });
