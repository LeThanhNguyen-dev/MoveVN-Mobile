# Kế hoạch UI/UX — Chi tiết xe (Mobile)

> Mockup tham chiếu: [`vehicle-detail-mockup.html`](./vehicle-detail-mockup.html)
> Phạm vi: `MoveVN-Mobile/src/features/vehicles/screens/VehicleDetailScreen.tsx`
> Không đổi API/backend. Chỉ dùng dependency đã có (`expo-linear-gradient`, `lucide-react-native`, `expo-image`).

---

## 1. Vấn đề của bản hiện tại

| # | Vấn đề | Hệ quả |
|---|--------|--------|
| 1 | 10+ khối `card` trắng giống hệt nhau, cùng padding/radius | Không có phân cấp thị giác, người dùng không biết đọc gì trước |
| 2 | Giá và CTA lặp 3 lần (footer, card "Thời gian thuê", nút trong card) | Rối, nhiều điểm chạm cùng một hành động |
| 3 | Bảng giá theo từng ngày render thẳng vào trang | Trang dài, nhiều số, loãng thông tin chính |
| 4 | Nhãn 12–13px + màu muted tràn lan; section title 17px | Chữ nhiều nhưng không có điểm nhấn, mỏi mắt |
| 5 | Mỗi section một kiểu (icon/no icon, card/không card) | Bố cục "lộn xộn", thiếu nhịp |
| 6 | Header "Chi tiết xe" chiếm chỗ, ảnh bắt đầu ngay dưới | Mất cơ hội tạo ấn tượng đầu |
| 7 | Alert/Report/Cọc/Phụ phí chen giữa luồng đọc | Ngắt mạch thông tin thuê xe |

## 2. Nguyên tắc thiết kế

1. **Một điểm nhấn mỗi vùng nhìn**: ảnh lớn → card tóm tắt → đúng 3 khối được tô màu (trạng thái lịch, lịch & giá, điểm đánh giá).
2. **Quét 3 giây**: Tên xe → giá → còn trống/bận → 4 thông số nhanh.
3. **Một CTA duy nhất**: thanh dưới cố định; bỏ toàn bộ nút đặt xe/đổi ngày lặp trong nội dung.
4. **Bớt chữ, thêm nhịp**: section header 18px + icon medal, nội dung 13–14px; mỗi đoạn tối đa 3–4 dòng trước khi "Xem thêm".
5. **Nền phẳng, viền mảnh**: chỉ dùng card cho khối cần tách biệt; phần còn lại dùng divider + khoảng thở.
6. **Màu hiện đại nhưng không lỗi thời**: tím thương hiệu làm chủ đạo, mint cho trạng thái tốt, amber cho đánh giá; nền lavender ấm, không dùng đen tuyệt đối.

## 3. Wireframe (thứ tự dọc)

```
┌──────────────────────────────┐
│  ẢNH LỚN 4:3 (edge-to-edge)   │  ← back / share / yêu thích (glass)
│  [Ô tô tự lái] [Miễn thế chấp]│
│  [Xem 8 ảnh]           [1/8]  │
├──────────────────────────────┤
│ CARD TÓM TẮT (đè lên ảnh)      │
│ PORSCHE · 4S      3.900.000đ  │
│ Panamera 2022        /ngày    │
│ 📍 Quận 1 · ★ 4.9 (38)        │
│ ─────────────────────────────│
│ Năm  ODO  Loại  Thế chấp      │  ← 4 fact tiles
├──────────────────────────────┤
│ ✓ Còn trống 12–15/11   [Đổi] │  ← mint banner
├──────────────────────────────┤
│ CARD LỊCH & GIÁ               │
│ Nhận xe 12/11 ⇄ Trả xe 15/11  │
│ 3 ngày × 3.9tr    11.700.000  │
│ Giảm dài ngày     −1.170.000  │
│ Tạm tính          10.530.000  │
│ [Xem chi tiết giá theo ngày]  │
├──────────────────────────────┤
│ OWNER ROW (avatar → hồ sơ)    │
│ Về chiếc xe (3 dòng + xem thêm)│
│ Tiện ích (grid 2 cột, icon)   │
├──────────────────────────────┤
│ CARD CHÍNH SÁCH & PHÍ         │
│ Giao xe / Đặt cọc / Thế chấp  │
│ / Phụ phí (row + chevron)     │
├──────────────────────────────┤
│ MAP CARD (148px + địa chỉ)    │
│ ĐÁNH GIÁ (4.9 + 38 + bars)    │
│ [review card] [review card] → │
│ Báo cáo thông tin xe (text)   │
├──────────────────────────────┤
│ 10.530.000đ   [ ĐẶT XE → ]    │  ← sticky, glass blur
└──────────────────────────────┘
```

## 4. Design tokens

### Màu — Light

| Token | Giá trị | Dùng cho |
|---|---|---|
| `bg` | `#F5F3FA` | nền trang |
| `surface` | `#FFFFFF` | card, dock |
| `surfaceAlt` | `#FAF8FF` | date box, policy icon |
| `ink` | `#161226` | tiêu đề, giá trị |
| `muted` | `#6F6A82` | nội dung phụ |
| `faint` | `#9A94AC` | caption, label |
| `line` | `#ECE7F5` | divider, border |
| `brand` | `#6B19FF` | CTA, link, icon medal |
| `brandGradient` | `#7C3AED → #6B19FF → #A855F7` | CTA, pin, avatar |
| `brandSoft` | `#F2EAFF` | tint icon/kicker |
| `mint` / `mintSoft` | `#07966F` / `#E8F8F1` | còn trống, miễn thế chấp |
| `amber` / `amberSoft` | `#D99406` / `#FFF6E2` | sao, điểm đánh giá |
| `rose` / `roseSoft` | `#D93B4B` / `#FDECEF` | xe bận, lỗi |

### Màu — Dark

| Token | Giá trị |
|---|---|
| `bg` | `#0E0B18` |
| `surface` | `#191527` |
| `surfaceAlt` | `#211B33` |
| `ink` | `#F5F2FF` |
| `muted` | `#A8A1C2` |
| `line` | `#2C2542` |
| `brand` | `#9B6BFF` |
| `brandSoft` | `#2A2050` |
| `mint` / `mintSoft` | `#3ED9A4` / `#14352B` |
| `amber` / `amberSoft` | `#F5B93F` / `#34280F` |

> Không sửa bảng màu toàn app. Bổ sung các token trên vào `Theme` dưới dạng optional, hoặc khai báo page-scope trong `features/vehicles/theme/vehicleDetailTheme.ts` để tránh ảnh hưởng màn khác.

### Typography

- Display (Quicksand 700): tên xe 23/28, section 18/24, giá lớn 19–21.
- Body (Be Vietnam Pro): nội dung 13/22, phụ 11–12/18, label 9–10 uppercase +0.5 letter-spacing.
- Giá dùng `fontVariant: ["tabular-nums"]` để số không nhảy.
- Tối đa 2 cỡ chữ trong cùng một khối.

### Hình học

- Radius: hero 0 (bo góc dưới 0 vì card đè), card 24, inner 14–16, pill 999.
- Spacing: gutter 14–20, section gap 22, card padding 16–18.
- Shadow: `0 18px 40px -22px rgba(38,22,86,.10)` — mềm, không đổ đen.
- Touch target ≥ 44×44; icon button 38×38 chỉ khi có hitSlop 6.

## 5. Icon map (Lucide)

| Ngữ cảnh | Icon |
|---|---|
| Back / Share / Yêu thích | `ArrowLeft`, `Share2`, `Heart` |
| Ảnh | `Images` |
| Loại xe | `Car` / `Bike` |
| Năm sản xuất | `CalendarDays` |
| ODO | `Gauge` |
| Thế chấp | `ShieldCheck` |
| Còn trống / bận | `CheckCircle2` / `AlertCircle` |
| Lịch thuê | `CalendarRange`, `KeyRound`, `ArrowLeftRight` |
| Chủ xe | `BadgeCheck`, `ChevronRight` |
| Tiện ích | `Sparkles`, `Camera`, `Music2`, `Gauge`, `Armchair`, `Sun` |
| Giao xe | `Truck` |
| Đặt cọc / phụ phí | `ReceiptText` |
| Bản đồ | `MapPin`, `Map` |
| Đánh giá | `Star` |
| Báo cáo | `Flag` |
| CTA | `ArrowRight` |

## 6. Spec từng khối & mapping dữ liệu

### 6.1 Hero
- `photos` (đã có sẵn), `FlatList` paging, `imageIndex`, mở viewer.
- Overlay gradient 2 đầu để chữ trắng đọc được.
- Topbar trong suốt: back, share (nếu có), `FavoriteVehicleButton` (style glass).
- Chip loại xe + "Miễn thế chấp" (nếu `!securityRequiresDeposit`).
- Pill "Xem N ảnh" mở viewer; counter "1/N".
- Không còn header bar "Chi tiết xe" chiếm dòng.

### 6.2 Summary card
- Đè lên hero `marginTop: -30`, radius 26, shadow.
- Kicker: `brandName · variantName`.
- Title: `brandName + modelName + year` (hiện tại đã có).
- Meta: `areaName`, `average rating`, `reviews.length`.
- Giá: `currentPricePerDay` hoặc quote average; note "Chưa gồm phí".
- Facts: Năm / ODO / Loại xe / Thế chấp — **chỉ dùng field đang có** (`year`, `odometerKm`, `vehicleType`, `securityRequiresDeposit`).
  - Nếu sau này API trả `seatCount`, `fuelType`, `transmission` thì thay ODO/Loại xe bằng các fact hữu ích hơn.

### 6.3 Availability banner
- 3 trạng thái:
  - Trống: mint — "Còn trống · {ngày}" / "Không trùng lịch bận của xe".
  - Bận: rose — "Xe đã bận trong khoảng này" + CTA "Đổi ngày".
  - Chưa tải: surfaceAlt — "Chưa kiểm tra được lịch" + "Thử lại".
- `AvailabilityAlertPanel` giữ nguyên, đặt ngay dưới banner (nếu có nội dung).

### 6.4 Lịch & giá
- 2 date box + nút swap ở giữa; mở `RentalPeriodSheet` (tái sử dụng).
- Dòng tiền: tiền thuê, giảm dài ngày, tạm tính.
- **Bảng giá từng ngày chuyển vào collapsible** "Xem chi tiết giá theo ngày" (mặc định đóng).
- Bỏ nút "Đặt xe ngay" trong card — chỉ còn ở sticky bar.
- Footnote 9.5px: "Chưa gồm phí giao xe & phụ phí".
- `quoteState` loading/error giữ nguyên logic, hiển thị skeleton 2 dòng thay vì text dài.

### 6.5 Owner
- Avatar chữ cái đầu + tên + "Chủ xe" + `BadgeCheck`; tap mở profile (`onOpenUserProfile`).
- Rút gọn còn 1 dòng, bỏ card riêng.

### 6.6 Về chiếc xe
- 3 dòng mặc định, "Xem thêm/Thu gọn" khi > 180 ký tự.
- Không card; nằm trên nền trang, có divider với khối trên/dưới.

### 6.7 Tiện ích
- Grid 2 cột, chip có icon + label (thay vì chip text trơn).
- Map icon theo tên feature (fallback `Check`).

### 6.8 Chính sách & phí
- Card duy nhất, 4 row có icon + value + chevron:
  - Giao xe: `deliveryFreeRadiusKm`, `deliveryFeePerKm`.
  - Đặt cọc: `depositPercent`.
  - Thế chấp: `securityRequiresDeposit` + `securityDepositAmount`.
  - Phụ phí: `surchargePolicies.length`; mở `SurchargePolicySummary` (modal/sheet) thay vì render dài trong trang.
- Value tốt (miễn phí/không yêu cầu) dùng mint.

### 6.9 Bản đồ
- Card 148px, pin gradient, nút "Mở bản đồ"; footer địa chỉ.
- `OwnerVehicleMap` hiện tại có thể giữ, chỉ cần bọc lại trong card mới và thêm overlay.

### 6.10 Đánh giá
- Header + "Xem tất cả".
- Card tổng: điểm lớn 4.9 + 5 sao + 38 đánh giá + distribution bars (tính từ `reviews`).
- Review cards cuộn ngang 252px, snap; 3 review đầu.
- "Xem tất cả" mở danh sách đầy đủ (modal/sheet) thay vì expand inline.
- Empty state: "Xe chưa có đánh giá" + icon `Star`.

### 6.11 Báo cáo
- Text link nhỏ, cuối trang, icon `Flag`, màu faint — không cạnh tranh CTA.

### 6.12 Sticky bar
- Glass blur + border-top.
- Trái: "Tạm tính · N ngày", số tiền lớn, dòng "Tiết kiệm X" (nếu có).
- Phải: CTA gradient "Đặt xe".
- Khi chưa chọn ngày: hiện "Chọn ngày thuê" + giá/ngày.
- `canBook` giữ nguyên logic hiện tại.

## 7. Motion & micro-interaction

- Ảnh: fade-in 150ms (đã có), parallax nhẹ khi scroll (RN `Animated`, không thêm deps).
- Card summary trượt lên 12px + fade khi mount (250ms).
- Nút: scale 0.97 khi press (dùng `Pressable` style function).
- Skeleton shimmer cho lần tải đầu (thay spinner toàn trang).
- Không dùng animation > 300ms; tôn trọng `reduce motion` nếu có.

## 8. Cấu trúc code đề xuất

```
src/features/vehicles/
  components/detail/
    VehicleDetailHero.tsx
    VehicleSummaryCard.tsx
    VehicleFactsRow.tsx
    VehicleAvailabilityBanner.tsx
    VehicleRentalCard.tsx
    VehicleOwnerRow.tsx
    VehicleAboutSection.tsx
    VehicleFeaturesSection.tsx
    VehiclePoliciesCard.tsx
    VehicleMapCard.tsx
    VehicleReviewsSection.tsx
    VehicleBookingDock.tsx
    VehicleDetailSkeleton.tsx
    theme.ts
```

- `VehicleDetailScreen.tsx` chỉ còn: fetch, state, compose sections, sheet/modal.
- Tái sử dụng: `RentalPeriodSheet`, `OwnerVehicleMap`, `SurchargePolicySummary`, `FavoriteVehicleButton`, `AvailabilityAlertPanel`, `ReportViolationButton`.
- Không tạo context/store mới; truyền props rõ ràng.

## 9. Lộ trình triển khai

| Phase | Nội dung | Kết quả |
|---|---|---|
| **P0** | Thêm token màu/typography page-scope; tách skeleton | Nền tảng visual, không ảnh hưởng màn khác |
| **P1** | Hero + Summary + Facts + Sticky dock | Ấn tượng đầu và CTA hoàn chỉnh |
| **P2** | Availability + Lịch & giá + collapsible quote | Luồng đặt xe gọn, hết CTA trùng |
| **P3** | Owner / About / Features / Policies / Map / Reviews / Report | Đủ nội dung, đúng thứ tự đọc |
| **P4** | Dark mode, accessibility, motion, edge cases, test | Sẵn sàng merge |

## 10. Kiểm thử & edge cases

- Kích thước: 360×800, 390×844, 430×932; landscape không bắt buộc.
- Nội dung dài: tên xe 2 dòng, owner name dài, description 500 ký tự, 20 features.
- Thiếu dữ liệu: không ảnh, không ODO, không địa chỉ, 0 đánh giá, quote lỗi.
- Trạng thái: xe bận, chưa tải lịch, mất mạng, retry.
- Dark mode: kiểm tra contrast chữ/giá, mint trên nền tối.
- Accessibility: `accessibilityLabel` cho back/share/favorite/CTA/ảnh; touch ≥ 44; contrast ≥ 4.5:1.
- Font scaling 1.3×: không cắt số tiền, không tràn fact row (dùng wrap hoặc giảm label).
- Chạy `npm run typecheck` và `npm test` trước khi bàn giao.

## 11. Ngoài phạm vi

- Không đổi API, không thêm field backend (seat/fuel/transmission).
- Không đổi logic tính giá, cọc, phụ phí.
- Không thêm thư viện animation mới.
