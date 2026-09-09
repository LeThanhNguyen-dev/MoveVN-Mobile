import type { AuthScreen } from "../utils/validation";

export const authCopy: Record<AuthScreen, { title: string; description: string; action: string }> = {
  login: { title: "Đăng nhập", description: "Chào mừng bạn quay lại MoveVN!", action: "Đăng nhập" },
  register: { title: "Tạo tài khoản", description: "Bắt đầu hành trình cùng MoveVN.", action: "Tạo tài khoản" },
  owner: { title: "Đăng ký chủ xe", description: "Chia sẻ chiếc xe của bạn với cộng đồng MoveVN.", action: "Đăng ký chủ xe" },
  forgot: { title: "Quên mật khẩu", description: "Nhập email để nhận mã OTP đặt lại mật khẩu.", action: "Gửi OTP" },
  reset: { title: "Đặt lại mật khẩu", description: "Tạo mật khẩu mới cho tài khoản MoveVN của bạn.", action: "Đặt lại mật khẩu" },
  verify: { title: "Xác thực email", description: "Nhập mã gồm 6 chữ số MoveVN đã gửi đến email của bạn.", action: "Xác thực" },
};
