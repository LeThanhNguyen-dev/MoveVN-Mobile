// Port từ web MoveVN-FrontEnd/src/features/admin/auditLogLabels.ts
// Chỉ đổi nhãn hiển thị; mã nhật ký gốc vẫn dùng để truy vấn API.
export const auditActionLabels: Record<string, string> = {
  "Wallet.BalanceChanged": "Thay đổi số dư ví",
  "Wallet.TransactionRecorded": "Ghi nhận bút toán ví",
  "Wallet.TransactionUpdated": "Cập nhật bút toán ví",
  "Payment.Created": "Tạo giao dịch thanh toán",
  "Payment.Updated": "Cập nhật kết quả thanh toán",
  "Withdrawal.Created": "Tạo yêu cầu rút tiền",
  "Withdrawal.Updated": "Cập nhật yêu cầu rút tiền",
  "Booking.Updated": "Cập nhật đơn đặt xe",
  "Booking.InspectionChanged": "Cập nhật biên bản giao/nhận xe",
  "Booking.SurchargeChanged": "Cập nhật phụ phí booking",
  "Contract.Updated": "Cập nhật thông tin hợp đồng",
  TrafficFineVerified: "Xác minh hồ sơ phạt nguội",
  TrafficFineResponsibilityResponded: "Khách phản hồi trách nhiệm phạt nguội",
  TrafficFinePaymentProofSubmitted: "Gửi chứng từ thanh toán phạt nguội",
  TrafficFineOwnerReceiptConfirmed: "Chủ xe xác nhận nhận tiền hoàn trả phạt nguội",
  TrafficFinePaymentVerified: "Duyệt chứng từ và hoàn tất phạt nguội",
  TrafficFinePaymentRejected: "Từ chối chứng từ phạt nguội",
  TrafficFineCaseRejected: "Từ chối hồ sơ phạt nguội",
  DisputeCreated: "Tạo hồ sơ khiếu nại",
  DisputeInvestigating: "Bắt đầu kiểm tra khiếu nại",
  DisputeNeedMoreEvidence: "Yêu cầu bổ sung bằng chứng",
  DisputeEvidenceSubmitted: "Gửi bằng chứng bổ sung",
  DisputeDecisionIssued: "Ghi nhận kết quả xử lý khiếu nại",
  DisputeResultAccepted: "Chấp nhận kết quả xử lý",
  DisputeEscalated: "Chuyển hồ sơ cho quản trị",
  DisputeAdminClosed: "Quản trị đóng hồ sơ",
  ExternalSettlementConfirmed: "Xác nhận quyết toán trực tiếp",
  "Contract.Create": "Tạo hợp đồng",
  "Contract.SendForSigning": "Gửi hợp đồng để ký",
  "Contract.Sign": "Ký hợp đồng",
  "Contract.Extend": "Gia hạn hợp đồng",
  "Contract.Cancel": "Hủy hợp đồng",
  "Contract.Complete": "Hoàn tất hợp đồng",
  "Contract.Terminate": "Chấm dứt hợp đồng",
  "Booking.Create": "Tạo đơn đặt xe",
  "Booking.Approve": "Duyệt đơn đặt xe",
  "Booking.Reject": "Từ chối đơn đặt xe",
  "Booking.Cancel": "Hủy đơn đặt xe",
  "Booking.ReturnReported": "Thông báo trả xe",
  "Booking.CheckInConfirm": "Xác nhận nhận xe",
  "Booking.StaffCheckIn": "Nhân viên xác nhận nhận xe",
  "Booking.CheckOutConfirm": "Xác nhận biên bản trả xe",
  "Booking.OwnerReceipt": "Chủ xe xác nhận nhận lại xe",
  "Booking.AutoReceipt": "Tự động xác nhận nhận lại xe",
  "Booking.OwnerNoShow": "Báo chủ xe không giao xe",
  "Booking.RequestSettlement": "Yêu cầu đối soát tiền đặt xe",
  "Booking.SurchargeRetryFailed": "Thu lại phụ phí thất bại",
  "Booking.EscrowRelease": "Giải ngân tiền đặt cọc",
  "Booking.CancellationSettle": "Đối soát tiền khi hủy đơn",
  "Booking.A1GrandfatherAllowed": "Chấp nhận giấy phép A1 theo quy định chuyển tiếp",
  BookingOwnerCancelled: "Chủ xe hủy đơn đặt xe",
  CheckInOverrideWithoutActiveContract: "Cho phép nhận xe khi hợp đồng chưa có hiệu lực",
  "Wallet.AdminAdjust": "Điều chỉnh số dư ví",
  "Wallet.PlatformFee": "Ghi nhận phí nền tảng",
  "Wallet.TransferBetweenUsers": "Chuyển tiền giữa các ví",
  "Withdrawal.Approve": "Duyệt yêu cầu rút tiền",
  "Withdrawal.Complete": "Hoàn tất rút tiền",
  "Withdrawal.Reject": "Từ chối yêu cầu rút tiền",
  "BankAccount.Update": "Cập nhật tài khoản ngân hàng",
  "SystemConfig.Update": "Cập nhật cấu hình hệ thống",
  UpdateInfo: "Cập nhật thông tin người dùng",
  CreateUser: "Tạo người dùng",
  update_user_info: "Cập nhật thông tin người dùng",
  create_user: "Tạo người dùng",
  AssignRole: "Gán vai trò",
  RemoveRole: "Gỡ vai trò",
  SuspendUser: "Khóa tài khoản",
  ActivateUser: "Kích hoạt tài khoản",
  DeleteUser: "Xóa tài khoản",
  RestoreUser: "Khôi phục tài khoản",
  ChangeStatus: "Đổi trạng thái tài khoản",
  RevokeSession: "Thu hồi phiên đăng nhập",
};

const roleLabels: Record<string, string> = {
  Admin: "Quản trị",
  Staff: "Nhân viên",
  Owner: "Chủ xe",
  Customer: "Khách hàng",
  System: "Hệ thống",
};

const entityLabels: Record<string, string> = {
  User: "Người dùng",
  Contract: "Hợp đồng",
  Booking: "Đơn đặt xe",
  Wallet: "Ví",
  WithdrawalRequest: "Yêu cầu rút tiền",
  OwnerProfile: "Hồ sơ chủ xe",
  CustomerProfile: "Hồ sơ khách hàng",
  SystemConfig: "Cấu hình hệ thống",
  Payment: "Thanh toán",
  Dispute: "Khiếu nại",
};

const statusLabels: Record<string, string> = {
  Submitted: "Chờ xác minh hồ sơ",
  AwaitingCustomerResponse: "Chờ khách xác nhận trách nhiệm",
  ResponsibilityDisputed: "Khách phản đối trách nhiệm",
  AwaitingPayment: "Chờ chứng từ thanh toán",
  PaymentProofSubmitted: "Chờ xác minh chứng từ",
  Resolved: "Đã xử lý",
  Draft: "Soạn thảo",
  PendingSigning: "Chờ ký",
  Overdue: "Quá hạn",
  Active: "Hoạt động",
  Pending: "Chờ duyệt",
  Approved: "Đã duyệt",
  Rejected: "Đã từ chối",
  Cancelled: "Đã hủy",
  Completed: "Hoàn thành",
  Terminated: "Chấm dứt",
  Superseded: "Đã thay thế",
  DepositPaid: "Đã thanh toán cọc",
  Confirmed: "Đã xác nhận",
  InProgress: "Đang thuê",
  Returning: "Đang trả xe",
  Returned: "Đã trả xe",
  Suspended: "Đã khóa",
  Deleted: "Đã xóa",
  Held: "Đang giữ tiền",
  Released: "Đã giải ngân",
  Refunded: "Đã hoàn tiền",
  Paid: "Đã thanh toán",
  Failed: "Thất bại",
  NeedsManualReview: "Cần kiểm tra thủ công",
  PendingConfirmation: "Chờ xác nhận",
  Unpaid: "Chưa thanh toán",
  Charged: "Đã thu tiền",
  Open: "Mới mở",
  Investigating: "Đang điều tra",
  NeedMoreEvidence: "Chờ bổ sung",
  Escalated: "Chuyển Admin",
  DecisionIssued: "Chờ xác nhận kết quả",
  AwaitingExternalSettlement: "Chờ xác nhận quyết toán",
};

const fieldLabels: Record<string, string> = {
  status: "Trạng thái",
  oldstatus: "Trạng thái trước",
  newstatus: "Trạng thái sau",
  role: "Vai trò",
  roles: "Vai trò",
  bookingid: "Mã đơn đặt xe",
  bookingcode: "Mã đặt xe",
  vehicleid: "Mã xe",
  contractnumber: "Số hợp đồng",
  version: "Phiên bản",
  amount: "Số tiền",
  balance: "Số dư",
  oldbalance: "Số dư trước",
  newbalance: "Số dư sau",
  escrowamount: "Tiền cọc đang giữ",
  escrowstatus: "Trạng thái giữ cọc",
  refundamount: "Tiền hoàn lại",
  forfeitedamount: "Tiền cọc bị khấu trừ",
  platformfee: "Phí nền tảng",
  feeamount: "Số tiền phí",
  owneramount: "Tiền chủ xe nhận",
  ownercompensation: "Tiền bồi thường chủ xe",
  payeruserid: "Mã người trả",
  payeeuserid: "Mã người nhận",
  transactiontype: "Loại giao dịch",
  note: "Ghi chú",
  reason: "Lý do",
  cancelreason: "Lý do hủy",
  error: "Lỗi",
  externaltransactionref: "Mã giao dịch bên ngoài",
  requestid: "Mã yêu cầu",
  idempotencykey: "Mã chống xử lý trùng",
  configkey: "Tên cấu hình",
  configvalue: "Giá trị cấu hình",
  fullname: "Họ và tên",
  email: "Email",
  phone: "Số điện thoại",
  phonenumber: "Số điện thoại",
  bankname: "Ngân hàng",
  bankaccountnumber: "Số tài khoản",
  bankaccountholder: "Chủ tài khoản",
  returnedat: "Thời điểm trả xe",
  settledat: "Thời điểm đối soát",
  cancelledat: "Thời điểm hủy",
  checkedinat: "Thời điểm nhận xe",
  actualreturnat: "Thời điểm trả xe thực tế",
  autoconfirmedat: "Thời điểm tự động xác nhận",
  autoconfirmhours: "Số giờ chờ xác nhận",
  escrowreleased: "Đã giải ngân cọc",
  overridereason: "Lý do cho phép ngoại lệ",
  trafficfine: "Hồ sơ phạt nguội",
  proofs: "Chứng từ",
  paymentproofs: "Chứng từ thanh toán",
  noticenumber: "Số thông báo",
  issuingauthority: "Đơn vị thông báo",
  licenseplate: "Biển số",
  violationat: "Thời điểm vi phạm",
  dueat: "Hạn xử lý",
  paymentmode: "Hình thức xử lý",
  ownerpaidat: "Ngày chủ xe nộp phạt",
  ownerpaymentevidenceurls: "Biên lai chủ xe nộp phạt",
  rentalstartat: "Bắt đầu khoảng thuê đối chiếu",
  rentalendat: "Kết thúc khoảng thuê đối chiếu",
  hasconfirmedrentaltimes: "Đã có đủ giờ giao/nhận thực tế",
  matchesrentalperiod: "Khớp khoảng thuê",
  verificationnote: "Kết quả đối chiếu",
  customerresponse: "Phản hồi khách",
  rejectionreason: "Lý do từ chối hồ sơ",
  ownerreceiptconfirmedat: "Ngày chủ xe xác nhận nhận tiền",
  transactionreference: "Mã biên lai/giao dịch",
  reviewedby: "Người kiểm tra",
  reviewedat: "Ngày kiểm tra",
  reviewnote: "Kết quả kiểm tra",
  verifiedby: "Người xác minh",
  verifiedat: "Ngày xác minh",
  isoverdue: "Quá hạn",
  id: "Mã bản ghi",
  payerid: "Người thanh toán",
  userid: "Người dùng",
  ownerid: "Chủ xe",
  customerid: "Khách thuê",
  walletid: "Mã ví",
  wallettransactionid: "Mã bút toán",
  referenceid: "Mã tham chiếu",
  type: "Loại",
  gateway: "Cổng thanh toán",
  gatewaytransactionid: "Mã giao dịch cổng thanh toán",
  ordercode: "Mã đơn thanh toán",
  paidat: "Thời điểm thanh toán",
  refundedat: "Thời điểm hoàn tiền",
  refundedamount: "Số tiền đã hoàn",
  currency: "Đơn vị tiền",
  balanceafter: "Số dư sau bút toán",
  balancebefore: "Số dư trước bút toán",
  totalearned: "Tổng tiền đã nhận",
  totalspent: "Tổng tiền đã chi",
  processedby: "Người xử lý",
  processedat: "Thời điểm xử lý",
  processnote: "Ghi chú xử lý",
  externalreference: "Mã giao dịch bên ngoài",
  revision: "Phiên bản dữ liệu",
  contractversion: "Phiên bản hợp đồng",
  depositamount: "Cọc booking",
  startdate: "Ngày bắt đầu",
  enddate: "Ngày kết thúc",
  odometerkm: "Số km",
  fuellevel: "Nhiên liệu",
  damagenoted: "Có hư hại",
  damagedescription: "Mô tả hư hại",
  feetype: "Loại phụ phí",
  resolution: "Kết quả xử lý",
  compensationdirection: "Hướng bồi thường",
  compensationamount: "Số tiền bồi thường",
  finalcompensationamount: "Số tiền bồi thường",
  settlementmethod: "Phương thức quyết toán",
  platformsettledamount: "Số tiền quyết toán qua ví",
  externalsettlementamount: "Số tiền quyết toán trực tiếp",
  paymentadjustmentnote: "Ghi chú điều chỉnh thanh toán",
  reporttype: "Loại khiếu nại",
  escalatedat: "Thời điểm chuyển quản trị",
  adminmanaged: "Do quản trị xử lý",
  resolvedat: "Thời điểm xử lý",
  resolvedby: "Người xử lý",
  closedat: "Thời điểm đóng hồ sơ",
  closedby: "Người đóng hồ sơ",
};

const transactionLabels: Record<string, string> = {
  BookingDeposit: "Thanh toán cọc booking",
  BookingDepositTopUp: "Bổ sung cọc booking",
  CheckIn: "Giao xe",
  CheckOut: "Trả xe",
  LateReturn: "Trả xe trễ",
  TopUp: "Nạp tiền",
  BookingEarning: "Thu nhập từ đặt xe",
  BookingPayment: "Thanh toán đặt xe",
  DisputeCompensation: "Bồi thường khiếu nại",
  PlatformFeeRevenue: "Thu phí nền tảng",
  Refund: "Hoàn tiền",
  PayoutReversal: "Hoàn lại tiền chuyển khoản",
  AdminAdjust: "Điều chỉnh số dư",
  Withdrawal: "Rút tiền",
  Penalty: "Phạt",
  PlatformFee: "Phí nền tảng",
  BookingEarningReversal: "Thu hồi thu nhập đặt xe",
  AutoPayout: "Tự động chuyển tiền",
};

const compensationLabels: Record<string, string> = {
  CustomerPaysOwner: "Khách bồi thường cho chủ xe",
  OwnerRefundsCustomer: "Chủ xe hoàn/giảm tiền cho khách",
  NoCompensation: "Không phát sinh bồi thường",
};

const settlementLabels: Record<string, string> = {
  ExternalOnly: "Thanh toán trực tiếp giữa hai bên",
  DepositThenExternal: "Thanh toán từ ví, phần thiếu thanh toán trực tiếp",
};

const disputeProblemLabels: Record<string, string> = {
  Damage: "Hư hại xe",
  Payment: "Thanh toán",
  LateReturn: "Trả xe muộn",
  Accident: "Tai nạn",
  TrafficFine: "Phạt nguội",
  Other: "Khác",
};

export function formatAuditRole(value?: string | null) {
  return value ? (roleLabels[value] ?? value) : "Hệ thống";
}

export function formatAuditEntity(value: string) {
  return entityLabels[value] ?? value;
}

export function formatAuditAction(value: string) {
  return auditActionLabels[value] ?? value;
}

export function formatAuditStatus(value?: string | null) {
  if (!value) return "—";
  return statusLabels[value] ?? value;
}

export function formatTransactionType(value?: string | null) {
  if (!value) return "—";
  return transactionLabels[value] ?? value;
}

export function formatAuditDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatStatus(value: string, entityType: string) {
  if (entityType === "Contract" && value === "Active") return "Đang hiệu lực";
  if (entityType === "Payment" && value === "Pending") return "Chờ thanh toán";
  return statusLabels[value] ?? value;
}

function formatValue(value: unknown, entityType: string, key = ""): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (
    typeof value === "number" &&
    (key.includes("amount") ||
      ["balance", "oldbalance", "newbalance", "balanceafter", "balancebefore", "totalearned", "totalspent", "platformfee"].includes(key))
  )
    return `${value.toLocaleString("vi-VN")}đ`;
  if (Array.isArray(value)) return value.map((item) => formatValue(item, entityType, key)).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([field, item]) => `${fieldLabels[field.toLowerCase()] ?? field}: ${formatValue(item, entityType, field.toLowerCase())}`)
      .join(" · ");
  }
  if (typeof value === "string") {
    if (key === "paymentmode")
      return value === "ReimburseOwner" ? "Hoàn trả khoản chủ xe đã ứng" : value === "CustomerPaysAuthority" ? "Khách tự nộp phạt" : value;
    if (key === "compensationdirection") return compensationLabels[value] ?? value;
    if (key === "settlementmethod") return settlementLabels[value] ?? value;
    if (key === "reporttype") return disputeProblemLabels[value] ?? value;
    if (!key || key.includes("status")) return formatStatus(value, entityType);
    if (key === "role" || key === "roles") return formatAuditRole(value);
    if (["transactiontype", "type", "feetype"].includes(key)) return transactionLabels[value] ?? value;
    if (key.endsWith("at") && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatAuditDateTime(value);
  }
  return String(value);
}

export function formatAuditDetail(value: string | null | undefined, entityType: string) {
  if (!value) return "—";
  let parsed: unknown = value;
  try {
    parsed = JSON.parse(value);
  } catch {
    /* Một số nhật ký lưu trạng thái dạng văn bản. */
  }
  if (typeof parsed === "string" && entityType === "User" && roleLabels[parsed]) {
    return formatAuditRole(parsed);
  }
  return formatValue(parsed, entityType);
}

export interface AuditDetailEntry {
  label: string;
  value: string;
}

function toDetailEntries(obj: Record<string, unknown>, entityType: string): AuditDetailEntry[] {
  const entries: AuditDetailEntry[] = [];
  for (const [field, item] of Object.entries(obj)) {
    const key = field.toLowerCase();
    entries.push({ label: fieldLabels[key] ?? field, value: formatValue(item, entityType, key) });
  }
  return entries;
}

/** Tách chi tiết nhật ký thành từng hàng label/value để render dạng danh sách thay vì đoạn văn. */
export function parseAuditDetailEntries(value: string | null | undefined, entityType: string): AuditDetailEntry[] {
  if (!value) return [];
  let parsed: unknown = value;
  try {
    parsed = JSON.parse(value);
  } catch {
    /* Một số nhật ký lưu trạng thái dạng văn bản. */
  }
  if (typeof parsed === "string") {
    if (entityType === "User" && roleLabels[parsed]) {
      return [{ label: fieldLabels.role ?? "Vai trò", value: formatAuditRole(parsed) }];
    }
    return [{ label: "", value: formatValue(parsed, entityType) }];
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return toDetailEntries(parsed as Record<string, unknown>, entityType);
  }
  return [{ label: "", value: formatValue(parsed, entityType) }];
}
