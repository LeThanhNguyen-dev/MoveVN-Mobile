# MoveVN Mobile

MoveVN Mobile là dự án **React Native** sử dụng **Expo**, **Expo Go** và **TypeScript**.

Tài liệu này hướng dẫn cách cài đặt môi trường, đăng nhập Expo, chạy ứng dụng trên điện thoại và xử lý một số lỗi cơ bản trong quá trình phát triển.

## Yêu cầu môi trường

Cần cài đặt sẵn các công cụ sau:

* Node.js phiên bản LTS hoặc phiên bản tương thích với Expo SDK hiện tại
* npm
* Expo Go trên điện thoại iOS hoặc Android
* Tài khoản Expo nếu sử dụng Expo Go SDK 57 trên iPhone

Kiểm tra phiên bản Node.js và npm:

```bash
node -v
npm -v
```

Nếu sử dụng PowerShell trên Windows và gặp lỗi:

```text
npm.ps1 cannot be loaded because running scripts is disabled
```

hãy sử dụng `npm.cmd` thay cho `npm`.

Ví dụ:

```bash
npm.cmd install
npm.cmd run start:lan
```

## Cài đặt dự án

Tại thư mục dự án, chạy:

```bash
npm.cmd install
```

Lệnh này sẽ cài đặt toàn bộ dependencies được khai báo trong `package.json`.

## Đăng nhập Expo

Với Expo Go SDK 57 trên iPhone, Expo yêu cầu đăng nhập cùng một tài khoản ở cả hai nơi:

* Expo Go trên điện thoại
* Expo CLI trên máy tính

Kiểm tra trạng thái đăng nhập trên máy tính:

```bash
npx.cmd expo whoami
```

Nếu kết quả là:

```text
Not logged in
```

thì đăng nhập Expo CLI bằng lệnh:

```bash
npx.cmd expo login
```

Nếu bạn đăng nhập Expo bằng Google, Apple, GitHub hoặc thông qua trình duyệt, có thể sử dụng:

```bash
npx.cmd expo login --browser
```

Nếu Windows gặp lỗi khi tự động mở trình duyệt, chạy:

```powershell
$env:BROWSER="none"
npx.cmd expo login --browser
```

Sau đó:

1. Sao chép đường dẫn `https://expo.dev/login?...` hiển thị trong terminal.
2. Dán đường dẫn vào trình duyệt.
3. Đăng nhập tài khoản Expo.
4. Giữ terminal đang mở cho đến khi Expo CLI thông báo đăng nhập thành công.

Kiểm tra lại bằng:

```bash
npx.cmd expo whoami
```

Nếu lệnh trả về username Expo của bạn thì quá trình đăng nhập đã thành công.

## Chạy ứng dụng trên Expo Go

Chạy Metro Dev Server bằng mạng LAN:

```bash
npm.cmd run start:lan
```

Sau khi terminal hiển thị mã QR:

1. Mở Expo Go trên điện thoại.
2. Đảm bảo điện thoại và máy tính đang kết nối cùng một mạng Wi-Fi.
3. Quét mã QR hiển thị trong terminal.
4. Chờ Expo Go tải và khởi chạy ứng dụng.

Nếu sử dụng iPhone, có thể quét mã QR bằng ứng dụng Camera hoặc trực tiếp trong Expo Go.

## Chạy ứng dụng không cần đăng nhập

Nếu chỉ muốn chạy ứng dụng local và tránh yêu cầu đăng nhập liên quan đến Expo manifest signing, có thể sử dụng chế độ offline:

```bash
npm.cmd run start:offline
```

Nếu đang phát triển bình thường và đã đăng nhập Expo CLI, nên ưu tiên sử dụng:

```bash
npm.cmd run start:lan
```

## Các lệnh thường sử dụng

### Chạy ứng dụng qua mạng LAN

```bash
npm.cmd run start:lan
```

Chạy ứng dụng trên điện thoại thông qua Expo Go bằng mạng LAN.

### Chạy ở chế độ offline

```bash
npm.cmd run start:offline
```

Chạy Expo ở chế độ offline, hạn chế các kết nối mạng từ Expo CLI.

### Xóa cache và chạy lại

```bash
npm.cmd run start:clear
```

Xóa cache của Metro và khởi động lại Dev Server.

Nên sử dụng khi:

* Ứng dụng gặp lỗi liên quan đến cache
* Code mới không được cập nhật
* Ứng dụng vẫn hiển thị nội dung cũ
* Metro hoạt động không đúng sau khi thay đổi dependencies

### Chạy trên Android

```bash
npm.cmd run android
```

Mở ứng dụng trên Android Emulator hoặc thiết bị Android nếu đã được cấu hình.

### Chạy trên iOS

```bash
npm.cmd run ios
```

Mở ứng dụng trên iOS Simulator.

> Lưu ý: iOS Simulator yêu cầu macOS.

### Chạy trên Web

```bash
npm.cmd run web
```

Chạy ứng dụng trên trình duyệt web.

### Kiểm tra TypeScript

```bash
npm.cmd run typecheck
```

Kiểm tra lỗi TypeScript mà không cần build ứng dụng.

## Kiểm tra cấu hình Expo

Chạy:

```bash
npx.cmd expo-doctor
```

Nếu kết quả cho thấy tất cả các kiểm tra đều thành công thì dependencies và cấu hình Expo đang hoạt động bình thường.

## Một số lỗi thường gặp và cách xử lý

### 1. Expo Go yêu cầu đăng nhập Expo Go và Expo CLI

Thông báo thường gặp:

```text
You need to be signed in to Expo Go and Expo CLI to open your project.
```

Cách xử lý:

```bash
npx.cmd expo login
npx.cmd expo whoami
npm.cmd run start:lan
```

Đảm bảo Expo Go trên điện thoại cũng đang đăng nhập bằng cùng tài khoản Expo được sử dụng trên máy tính.

### 2. Phiên bản SDK của project không tương thích với Expo Go

Thông báo thường gặp:

```text
Project is incompatible with this version of Expo Go
```

Nguyên nhân thường là phiên bản Expo SDK trong project không tương thích với phiên bản Expo Go được cài đặt trên điện thoại.

Project hiện tại sử dụng Expo SDK 57:

```json
"expo": "~57.0.20"
```

Nếu gặp lỗi này, chạy:

```bash
npx.cmd expo-doctor
npx.cmd expo install --fix
```

Sau đó xóa cache và chạy lại ứng dụng:

```bash
npm.cmd run start:clear
```

### 3. PowerShell chặn npm

Thông báo thường gặp:

```text
npm.ps1 cannot be loaded because running scripts is disabled on this system
```

Cách đơn giản nhất là sử dụng `npm.cmd` thay cho `npm`:

```bash
npm.cmd install
npm.cmd run start:lan
```

## Cấu trúc dự án

```text
App.tsx             Component chính của ứng dụng
index.ts            Entry point đăng ký ứng dụng với Expo
app.json            File cấu hình Expo
assets/             Chứa icon, favicon, hình ảnh và các tài nguyên mặc định
package.json        Khai báo dependencies và scripts của dự án
package-lock.json   Lockfile của npm
tsconfig.json       File cấu hình TypeScript
.gitignore          Danh sách file và thư mục không được đưa lên Git
```

## Công nghệ sử dụng

* React Native
* Expo
* Expo Go
* TypeScript
* Node.js
* npm

## Ghi chú

* Nên chạy `npm.cmd install` sau khi clone project về máy.
* Khi có thay đổi trong `package.json`, cần cài đặt lại dependencies.
* Nếu ứng dụng không cập nhật code mới, hãy thử `npm.cmd run start:clear`.
* Khi chạy trên thiết bị thật bằng LAN, máy tính và điện thoại cần kết nối cùng một mạng.
* Nên chạy `npx.cmd expo-doctor` khi gặp vấn đề liên quan đến dependencies hoặc cấu hình Expo.
