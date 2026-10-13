import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { ContractContent } from "@/features/contracts/types";
import { formatDate, formatDateTime, formatMoney } from "@/features/booking/utils/format";

const v = (x?: string | number | null) => (x === undefined || x === null || x === "" ? "-" : String(x));
const money = (x?: number | null) => `${new Intl.NumberFormat("vi-VN").format(x ?? 0)}đ`;

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.article}>
      <Text style={styles.articleTitle}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <Text style={styles.p}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.p}>• </Text>
      <Text style={[styles.p, styles.bulletText]}>{children}</Text>
    </View>
  );
}

function KV({ n, children }: { n: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Text style={styles.p}>
      <Text style={styles.bold}>{n}: </Text>
      {children}
    </Text>
  );
}

/** Văn bản hợp đồng đầy đủ như bản web (tiêu ngữ, các bên, Điều 1–15, ký điện tử). */
export default function ContractDocument({ content }: { content: ContractContent }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const s = content.data;
  const a = s?.owner;
  const b = s?.customer;
  const car = s?.vehicle;
  const time = s?.schedule;
  const amount = s?.money;
  const gplx = b?.driverLicenseNumber
    ? `${b.driverLicenseClass ? `${b.driverLicenseClass} · ` : ""}${b.driverLicenseNumber}`
    : "-";

  return (
    <View style={styles.doc}>
      <View style={styles.header}>
        <Text style={styles.motto}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
        <Text style={styles.motto}>Độc lập - Tự do - Hạnh phúc</Text>
        <Text style={styles.docTitle}>HỢP ĐỒNG THUÊ XE</Text>
        <Text style={styles.muted}>MoveVN – Smart Car Rental Management System</Text>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaCol}>
          <Text style={styles.muted}>Mã hợp đồng: <Text style={styles.bold}>{content.contractNumber}</Text></Text>
          <Text style={styles.muted}>Phiên bản: {content.version}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.muted}>Mã booking: <Text style={styles.bold}>{v(s?.bookingCode)}</Text></Text>
          <Text style={styles.muted}>Ngày tạo: {formatDate(content.createdAt)}</Text>
        </View>
      </View>

      <Text style={[styles.p, styles.justify, styles.bold]}>
        Căn cứ Bộ luật Dân sự số 91/2015/QH13; Căn cứ Luật Giao dịch điện tử; Căn cứ nhu cầu và sự thỏa thuận của các bên thông qua nền tảng MoveVN.
      </Text>

      <Article title="THÔNG TIN CÁC BÊN LIÊN QUAN">
        <Text style={styles.h3}>Bên Cho Thuê</Text>
        <KV n="Họ và tên">{v(a?.fullName)}</KV>
        <KV n="Số điện thoại">{v(a?.phone)}</KV>
        <KV n="Email">{v(a?.email)}</KV>
        <KV n="CCCD">{v(a?.nationalId ?? a?.nationalIdMasked)}</KV>
        <KV n="Địa chỉ">{v(a?.address)}</KV>
        <P>Sau đây gọi là Bên Cho Thuê.</P>
        <Text style={styles.h3}>Bên Thuê</Text>
        <KV n="Họ và tên">{v(b?.fullName)}</KV>
        <KV n="Số điện thoại">{v(b?.phone)}</KV>
        <KV n="Email">{v(b?.email)}</KV>
        <KV n="CCCD">{v(b?.nationalId ?? b?.nationalIdMasked)}</KV>
        <KV n="Giấy phép lái xe">{gplx}</KV>
        <P>Sau đây gọi là Bên Thuê.</P>
        <Text style={styles.h3}>Nền tảng MoveVN</Text>
        <P>MoveVN – Smart Car Rental Management System</P>
        <P>MoveVN là nền tảng cung cấp dịch vụ kết nối giữa Bên Cho Thuê và Bên Thuê, hỗ trợ đặt xe, thanh toán, xác thực thông tin, ký kết hợp đồng điện tử, ghi nhận quá trình giao nhận xe và hỗ trợ xử lý tranh chấp.</P>
      </Article>

      <Article title="ĐIỀU 1. THÔNG TIN PHƯƠNG TIỆN">
        <KV n="Loại phương tiện">{v(car?.vehicleType)}</KV>
        <KV n="Hãng xe">{v(car?.brand)}</KV>
        <KV n="Model">{v(car?.model)}</KV>
        <KV n="Phiên bản">{v(car?.variant)}</KV>
        <KV n="Biển số">{v(car?.licensePlate)}</KV>
        <P>Thông tin phương tiện được lấy từ hồ sơ phương tiện đã đăng ký trên nền tảng MoveVN.</P>
        <P>Tình trạng thực tế của phương tiện tại thời điểm bàn giao được ghi nhận riêng trong Check-in Record.</P>
      </Article>

      <Article title="ĐIỀU 2. THỜI GIAN VÀ ĐỊA ĐIỂM THUÊ">
        <KV n="Nhận xe">{formatDateTime(time?.startDate)}</KV>
        <KV n="Trả xe dự kiến">{formatDateTime(time?.endDate)}</KV>
        <KV n="Thời lượng thuê">{v(time?.totalDays)} ngày</KV>
        <KV n="Địa điểm nhận xe">{v(time?.pickupAddress)}</KV>
        <KV n="Địa điểm trả xe">{v(time?.returnAddress)}</KV>
        <P>Một ngày thuê được tính theo 24 giờ kể từ thời điểm nhận xe. Thời gian thực tế và tình trạng xe khi nhận/trả được ghi nhận tại Check-in/Check-out.</P>
      </Article>

      <Article title="ĐIỀU 3. GIÁ THUÊ, THANH TOÁN VÀ TIỀN ĐẶT CỌC">
        <MoneyRow label="Giá thuê cơ bản" value={money(amount?.basePrice)} header={false} />
        <MoneyRow label="Phí dịch vụ MoveVN" value={money(amount?.platformFee)} header={false} />
        <MoneyRow label="Giảm giá/Voucher" value={`-${money(amount?.promotionDiscount)}`} header={false} />
        {(amount?.deliveryFee ?? 0) > 0 ? (
          <MoneyRow label="Phí giao xe" value={money(amount?.deliveryFee)} header={false} />
        ) : null}
        <MoneyRow label="Tổng tiền thuê tại thời điểm ký" value={money(amount?.totalAmount)} header />
        <MoneyRow label="Tiền đặt cọc" value={money(amount?.depositAmount)} header={false} />
        {(amount?.securityDepositAmount ?? 0) > 0 ? (
          <MoneyRow label="Khoản đảm bảo" value={money(amount?.securityDepositAmount)} header={false} />
        ) : null}
        <P>Các khoản phí phát sinh sau thời điểm ký hợp đồng không được tính vào tổng tiền tại thời điểm ký. Các khoản này được xác định sau Check-out dựa trên tình trạng thực tế và chính sách thuê xe.</P>
      </Article>

      <Article title="ĐIỀU 4. PHÍ PHÁT SINH SAU KHI TRẢ XE">
        <P>Các khoản phí phát sinh chỉ được xác định khi hoàn tất Check-out và đối soát. Tổng phí phát sinh chưa được xác định tại thời điểm ký hợp đồng.</P>
        {(s?.surchargeTerms ?? []).length === 0 ? (
          <P>Không có khoản phí phát sinh được chốt trước.</P>
        ) : (
          (s?.surchargeTerms ?? []).map((t, i) => (
            <View key={i} style={styles.termBox}>
              <Text style={[styles.p, styles.bold]}>{t.name || t.feeType}</Text>
              <Text style={styles.p}>
                {t.description ||
                  `${t.calculationMethod === "PerHour" ? `${money(t.unitPrice)}/giờ` : money(t.unitPrice)}${t.lateDayThresholdHours ? `; quá ${t.lateDayThresholdHours} giờ tính thêm 01 ngày thuê theo chính sách` : ""}`}
              </Text>
            </View>
          ))
        )}
        <P>Nguyên tắc: Tổng phí phát sinh = tổng các khoản phí được xác định sau Check-out. Giá trị này được tạo thành Additional Charge/Phụ phí phát sinh trên hệ thống MoveVN và không làm thay đổi nội dung hợp đồng đã ký.</P>
      </Article>

      <Article title="ĐIỀU 5. GIAO NHẬN PHƯƠNG TIỆN">
        <P>Việc bàn giao phương tiện được thực hiện tại thời gian và địa điểm đã thỏa thuận. Tại thời điểm Check-in, hai bên thực hiện kiểm tra và ghi nhận:</P>
        {["Tình trạng ngoại thất.", "Tình trạng nội thất.", "Số km.", "Mức nhiên liệu hoặc mức pin.", "Phụ kiện đi kèm.", "Các hư hỏng đã có trước khi nhận xe.", "Hình ảnh/video phương tiện."].map((x) => (
          <Bullet key={x}>{x}</Bullet>
        ))}
        <P>Các thông tin này được ghi nhận trong Check-in Record và không phải là một phần của thông tin được xác định trước trong hợp đồng.</P>
      </Article>

      <Article title="ĐIỀU 6. QUYỀN VÀ NGHĨA VỤ CỦA BÊN CHO THUÊ">
        <P>Bên Cho Thuê có quyền và nghĩa vụ:</P>
        {["Bàn giao đúng phương tiện đã được xác nhận trong booking.", "Cung cấp thông tin phương tiện chính xác.", "Bàn giao phương tiện theo thời gian và địa điểm đã thỏa thuận.", "Cung cấp các giấy tờ cần thiết liên quan đến phương tiện theo quy định.", "Thông báo cho Bên Thuê các yêu cầu hoặc lưu ý khi sử dụng phương tiện.", "Kiểm tra phương tiện khi Bên Thuê trả xe.", "Cung cấp căn cứ đối với các khoản chi phí phát sinh do Bên Thuê gây ra.", "Hoàn trả tiền đặt cọc hoặc khoản đảm bảo theo thỏa thuận sau khi hoàn tất đối soát."].map((x) => (
          <Bullet key={x}>{x}</Bullet>
        ))}
      </Article>

      <Article title="ĐIỀU 7. QUYỀN VÀ NGHĨA VỤ CỦA BÊN THUÊ">
        <P>Bên Thuê có quyền và nghĩa vụ:</P>
        {["Cung cấp thông tin cá nhân và giấy tờ chính xác.", "Thanh toán đầy đủ các khoản tiền theo hợp đồng.", "Nhận và sử dụng đúng phương tiện đã đặt.", "Kiểm tra phương tiện tại thời điểm nhận xe.", "Bảo quản phương tiện trong suốt thời gian thuê.", "Sử dụng phương tiện đúng mục đích và quy định pháp luật.", "Không tự ý sửa chữa hoặc thay đổi phương tiện.", "Thông báo ngay cho Bên Cho Thuê khi phương tiện xảy ra sự cố hoặc tai nạn.", "Trả phương tiện đúng thời gian và địa điểm đã thỏa thuận.", "Thanh toán các khoản chi phí phát sinh thuộc trách nhiệm của mình."].map((x) => (
          <Bullet key={x}>{x}</Bullet>
        ))}
      </Article>

      <Article title="ĐIỀU 8. TRẢ XE VÀ ĐỐI SOÁT SAU CHECK-OUT">
        <P>Khi trả phương tiện, Bên Cho Thuê và Bên Thuê thực hiện kiểm tra phương tiện. Thông tin Check-out có thể bao gồm:</P>
        {["Thời gian trả xe.", "Số km tại thời điểm trả.", "Mức nhiên liệu/pin.", "Tình trạng ngoại thất.", "Tình trạng nội thất.", "Phụ kiện.", "Hình ảnh/video.", "Các hư hỏng hoặc mất mát phát sinh."].map((x) => (
          <Bullet key={x}>{x}</Bullet>
        ))}
        <P>Thông tin Check-out được lưu thành Check-out Record và được sử dụng để đối chiếu với Check-in Record.</P>
      </Article>

      <Article title="ĐIỀU 9. PHÍ PHÁT SINH VÀ BỒI THƯỜNG">
        <P>Các khoản phí phát sinh trong quá trình thuê hoặc sau khi trả xe có thể bao gồm:</P>
        {["Phí trả xe quá thời gian quy định.", "Phí vệ sinh theo chính sách áp dụng.", "Phí thiếu nhiên liệu hoặc pin.", "Phí mất hoặc hư hỏng phụ kiện.", "Chi phí sửa chữa thiệt hại do lỗi của Bên Thuê.", "Phạt giao thông hoặc các nghĩa vụ tài chính phát sinh do việc sử dụng phương tiện của Bên Thuê (xử lý theo Điều 10).", "Các khoản phí khác được hai bên xác nhận."].map((x) => (
          <Bullet key={x}>{x}</Bullet>
        ))}
        <P>Mỗi khoản phí phát sinh phải được ghi nhận trên hệ thống MoveVN cùng với lý do và thông tin liên quan.</P>
      </Article>

      <Article title="ĐIỀU 10. VI PHẠM GIAO THÔNG VÀ PHẠT NGUỘI">
        <P>Mọi hành vi vi phạm pháp luật về trật tự, an toàn giao thông (bao gồm vi phạm bị xử phạt trực tiếp và phạt nguội) phát sinh trong thời gian thuê, tính từ thời điểm nhận xe đến thời điểm trả xe thực tế được ghi nhận trên hệ thống, thuộc trách nhiệm của Bên Thuê.</P>
        {["Bên Thuê có nghĩa vụ chấp hành quyết định xử phạt, nộp phạt đầy đủ và đúng hạn, đồng thời bồi hoàn cho Bên Cho Thuê mọi chi phí liên quan đã ứng trước (tiền phạt nộp thay, chi phí làm việc với cơ quan chức năng, thiệt hại do phương tiện bị tạm giữ) kèm chứng từ hợp lệ.", "Bên Cho Thuê có trách nhiệm thông báo ngay cho Bên Thuê khi nhận được thông báo phạt nguội hoặc quyết định xử phạt liên quan đến thời gian cho thuê, đồng thời phối hợp đối chiếu thời gian vi phạm với thời gian thuê.", "MoveVN chỉ đóng vai trò trung gian kết nối giữa Bên Cho Thuê và Bên Thuê, không phải chủ phương tiện và không chịu trách nhiệm đối với hành vi vi phạm của Bên Thuê. Khi có yêu cầu hợp lệ từ cơ quan nhà nước có thẩm quyền hoặc để phục vụ giải quyết tranh chấp giữa hai bên, MoveVN sẵn sàng cung cấp các chứng cứ về thời gian thuê được lưu trữ trên hệ thống, bao gồm thông tin booking, hợp đồng điện tử, biên bản check-in/check-out và lịch sử giao dịch, thanh toán, nhằm xác định người điều khiển phương tiện tại thời điểm vi phạm.", "Trường hợp phạt nguội được thông báo sau khi hợp đồng đã kết thúc, các bên vẫn có trách nhiệm phối hợp xử lý theo Điều này; MoveVN hỗ trợ liên lạc giữa các bên và cung cấp hồ sơ khi được yêu cầu hợp lệ."].map((x) => (
          <Bullet key={x}>{x}</Bullet>
        ))}
      </Article>

      <Article title="ĐIỀU 11. TAI NẠN, SỰ CỐ VÀ THIỆT HẠI">
        <P>Trong trường hợp xảy ra tai nạn hoặc sự cố:</P>
        {["Bên Thuê phải thông báo cho Bên Cho Thuê trong thời gian sớm nhất.", "Bên Thuê phải cung cấp thông tin và bằng chứng liên quan khi được yêu cầu.", "Không tự ý sửa chữa phương tiện nếu chưa được Bên Cho Thuê đồng ý, trừ trường hợp cần thiết để đảm bảo an toàn.", "Hai bên phối hợp với MoveVN để ghi nhận và xử lý sự cố.", "Trách nhiệm bồi thường được xác định dựa trên nguyên nhân, bằng chứng và các thỏa thuận áp dụng."].map((x) => (
          <Bullet key={x}>{x}</Bullet>
        ))}
      </Article>

      <Article title="ĐIỀU 12. HỦY BOOKING VÀ CHẤM DỨT HỢP ĐỒNG">
        <P>Hợp đồng có thể được hủy hoặc chấm dứt trong các trường hợp:</P>
        {["Bên Thuê hủy booking theo chính sách của MoveVN.", "Bên Cho Thuê hủy booking theo trường hợp được phép.", "Hai bên thỏa thuận chấm dứt.", "Một bên vi phạm nghiêm trọng nghĩa vụ trong hợp đồng.", "Phương tiện không thể tiếp tục được sử dụng.", "Trường hợp bất khả kháng.", "Các trường hợp khác theo quy định pháp luật."].map((x) => (
          <Bullet key={x}>{x}</Bullet>
        ))}
        <P>Việc hoàn tiền, xử lý tiền đặt cọc và các khoản phí liên quan được thực hiện theo chính sách áp dụng cho booking.</P>
      </Article>

      <Article title="ĐIỀU 13. GIẢI QUYẾT TRANH CHẤP">
        <P>Các bên ưu tiên giải quyết tranh chấp bằng thương lượng. Nếu tranh chấp không thể giải quyết bằng thương lượng, Bên Cho Thuê hoặc Bên Thuê có thể gửi yêu cầu hỗ trợ thông qua nền tảng MoveVN. MoveVN có thể tiếp nhận thông tin, bằng chứng và lịch sử giao dịch để hỗ trợ quá trình xử lý tranh chấp. Việc giải quyết tranh chấp cuối cùng được thực hiện theo thỏa thuận giữa các bên và quy định pháp luật có liên quan.</P>
      </Article>

      <Article title="ĐIỀU 14. HỢP ĐỒNG ĐIỆN TỬ">
        <P>Hợp đồng được lập và ký dưới hình thức điện tử trên nền tảng MoveVN. Hai bên xác nhận đã đọc, hiểu và đồng ý với nội dung hợp đồng trước khi ký. Hệ thống ghi nhận người ký, thời gian ký, phương thức xác thực và phiên bản hợp đồng.</P>
      </Article>

      <Article title="ĐIỀU 15. HIỆU LỰC HỢP ĐỒNG">
        <P>Hợp đồng có hiệu lực kể từ thời điểm các bên hoàn tất việc ký điện tử theo quy trình của MoveVN.</P>
        <P>Hợp đồng tiếp tục có hiệu lực trong thời gian thuê và cho đến khi các bên hoàn tất các nghĩa vụ liên quan, bao gồm việc trả xe, đối soát các khoản thanh toán, phí phát sinh và hoàn trả tiền đặt cọc/khoản đảm bảo nếu có.</P>
        <P>Các thông tin Booking, Check-in, Check-out, Payment, Additional Charge và Dispute được lưu trữ riêng trên hệ thống MoveVN và có thể được liên kết với hợp đồng để phục vụ việc thực hiện và đối chiếu hợp đồng.</P>
      </Article>

      <View style={styles.signBlock}>
        <Text style={styles.signTitle}>THÔNG TIN KÝ ĐIỆN TỬ</Text>
        <View style={styles.signGrid}>
          <View style={styles.signCol}>
            <Text style={styles.bold}>BÊN CHO THUÊ</Text>
            <Text style={styles.p}>({content.ownerSignStatus === "Signed" ? "Đã ký điện tử" : "Chưa ký"})</Text>
            <Text style={styles.p}>Họ tên: {v(a?.fullName)}</Text>
            <Text style={styles.p}>Thời gian ký: {content.ownerSignedAt ? formatDateTime(content.ownerSignedAt) : "-"}</Text>
            <Text style={[styles.p, styles.bold, content.ownerSignStatus === "Signed" && styles.signed]}>
              {content.ownerSignStatus === "Signed" ? "ĐÃ KÝ" : "CHƯA KÝ"}
            </Text>
          </View>
          <View style={styles.signCol}>
            <Text style={styles.bold}>BÊN THUÊ</Text>
            <Text style={styles.p}>({content.customerSignStatus === "Signed" ? "Đã ký điện tử" : "Chưa ký"})</Text>
            <Text style={styles.p}>Họ tên: {v(b?.fullName)}</Text>
            <Text style={styles.p}>Thời gian ký: {content.customerSignedAt ? formatDateTime(content.customerSignedAt) : "-"}</Text>
            <Text style={[styles.p, styles.bold, content.customerSignStatus === "Signed" && styles.signed]}>
              {content.customerSignStatus === "Signed" ? "ĐÃ KÝ" : "CHƯA KÝ"}
            </Text>
          </View>
        </View>
        <Text style={styles.verify}>Mã xác thực hợp đồng: {content.verificationCode || "-"}</Text>
      </View>
    </View>
  );
}

function MoneyRow({ label, value, header }: { label: string; value: string; header: boolean }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.moneyRow, header && styles.moneyTotal]}>
      <Text style={[styles.p, header && styles.bold]}>{label}</Text>
      <Text style={[styles.p, header && styles.bold]}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    doc: { gap: 6, paddingBottom: 8 },
    header: { alignItems: "center", gap: 2, marginBottom: 8 },
    motto: { color: theme.text, fontSize: 12, fontWeight: "700", textAlign: "center" },
    docTitle: { color: theme.text, fontSize: 20, fontWeight: "800", marginTop: 8, textAlign: "center" },
    muted: { color: theme.muted, fontSize: 12, textAlign: "center" },
    metaGrid: { flexDirection: "row", gap: 12, marginVertical: 6 },
    metaCol: { flex: 1, gap: 2 },
    bold: { fontWeight: "700", color: theme.text },
    p: { color: theme.text, fontSize: 13, lineHeight: 19, marginBottom: 5 },
    justify: { textAlign: "justify" },
    article: { marginTop: 10 },
    articleTitle: { color: theme.text, fontSize: 14, fontWeight: "800", marginBottom: 6 },
    h3: { color: theme.text, fontSize: 13, fontWeight: "800", marginTop: 6, marginBottom: 3 },
    bulletRow: { flexDirection: "row", paddingRight: 4 },
    bulletText: { flex: 1 },
    moneyRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 6,
    },
    moneyTotal: { backgroundColor: theme.surfaceAlt },
    termBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 10,
      marginBottom: 6,
      gap: 3,
    },
    signBlock: { alignItems: "center", marginTop: 14, gap: 8 },
    signTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    signGrid: { flexDirection: "row", gap: 12, width: "100%" },
    signCol: { flex: 1, alignItems: "center", gap: 3 },
    signed: { color: "#047857" },
    verify: { color: theme.muted, fontSize: 12, marginTop: 4 },
  });
