# MoveVN Mobile

MoveVN Mobile la du an React Native su dung Expo, Expo Go va TypeScript.

Tai lieu nay huong dan cach cai dat, dang nhap Expo, chay ung dung tren dien thoai va kiem tra loi co ban trong qua trinh phat trien.

## Yeu cau moi truong

Can cai san cac cong cu sau:

- Node.js ban LTS hoac ban tuong thich voi Expo SDK hien tai
- npm
- Expo Go tren dien thoai iOS hoac Android
- Tai khoan Expo neu dung Expo Go SDK 57 tren iPhone

Kiem tra Node.js va npm:

```bash
node -v
npm -v
```

Neu dung PowerShell tren Windows va gap loi `npm.ps1 cannot be loaded because running scripts is disabled`, hay dung `npm.cmd` thay cho `npm`.

Vi du:

```bash
npm.cmd install
npm.cmd run start:lan
```

## Cai dat du an

Tai thu muc du an, chay:

```bash
npm.cmd install
```

Lenh nay cai toan bo dependencies trong `package.json`.

## Dang nhap Expo

Voi Expo Go SDK 57 tren iPhone, Expo yeu cau dang nhap cung mot tai khoan o ca hai noi:

- Expo Go tren dien thoai
- Expo CLI tren may tinh

Kiem tra trang thai dang nhap tren may tinh:

```bash
npx.cmd expo whoami
```

Neu ket qua la:

```text
Not logged in
```

thi dang nhap Expo CLI:

```bash
npx.cmd expo login
```

Neu ban dang nhap Expo bang Google, Apple, GitHub hoac trinh duyet, co the dung:

```bash
npx.cmd expo login --browser
```

Neu Windows bi loi khi tu mo trinh duyet, chay:

```powershell
$env:BROWSER="none"
npx.cmd expo login --browser
```

Sau do copy link `https://expo.dev/login?...` trong terminal, dan vao trinh duyet, dang nhap, va giu terminal dang mo cho den khi CLI bao thanh cong.

Dang nhap thanh cong khi:

```bash
npx.cmd expo whoami
```

tra ve username Expo cua ban.

## Chay ung dung tren Expo Go

Chay Metro dev server bang LAN:

```bash
npm.cmd run start:lan
```

Sau khi terminal hien QR code:

- Mo Expo Go tren dien thoai
- Dam bao dien thoai va may tinh dang dung cung mang Wi-Fi
- Quet QR code trong terminal

Neu dung iPhone, co the quet bang Camera app hoac trong Expo Go.

## Chay khong can dang nhap

Neu chi muon chay local va tranh yeu cau dang nhap cua Expo manifest signing, co the dung offline mode:

```bash
npm.cmd run start:offline
```

Neu dang phat trien binh thuong va da dang nhap Expo CLI, uu tien dung:

```bash
npm.cmd run start:lan
```

## Lenh hay dung

```bash
npm.cmd run start:lan
```

Chay app tren dien thoai qua Expo Go bang mang LAN.

```bash
npm.cmd run start:offline
```

Chay Expo o che do offline, han che viec goi network cua CLI.

```bash
npm.cmd run start:clear
```

Xoa cache Metro va chay lai dev server. Dung khi app bi loi cache, khong cap nhat code, hoac man hinh hien noi dung cu.

```bash
npm.cmd run android
```

Mo app tren Android emulator hoac thiet bi Android neu da cau hinh.

```bash
npm.cmd run ios
```

Mo app tren iOS simulator. Lenh nay can macOS.

```bash
npm.cmd run web
```

Chay app tren trinh duyet web.

```bash
npm.cmd run typecheck
```

Kiem tra TypeScript ma khong build app.

## Kiem tra cau hinh Expo

Chay:

```bash
npx.cmd expo-doctor
```

Neu ket qua hien tat ca checks passed thi dependencies va cau hinh Expo dang on.

## Loi da gap va cach xu ly

### Loi yeu cau dang nhap Expo Go va Expo CLI

Thong bao thuong gap:

```text
You need to be signed in to Expo Go and Expo CLI to open your project.
```

Cach xu ly:

```bash
npx.cmd expo login
npx.cmd expo whoami
npm.cmd run start:lan
```

Dam bao Expo Go tren dien thoai cung dang nhap dung tai khoan do.

### Loi sai SDK giua project va Expo Go

Thong bao thuong gap:

```text
Project is incompatible with this version of Expo Go
```

Nguyen nhan la version Expo SDK trong project khong khop voi version Expo Go tren dien thoai.

Project hien tai dang dung Expo SDK 57:

```json
"expo": "~57.0.20"
```

Neu gap loi nay, chay:

```bash
npx.cmd expo-doctor
npx.cmd expo install --fix
```

Sau do chay lai:

```bash
npm.cmd run start:clear
```

### Loi PowerShell chan npm

Thong bao thuong gap:

```text
npm.ps1 cannot be loaded because running scripts is disabled on this system
```

Cach nhanh nhat la dung `npm.cmd`:

```bash
npm.cmd install
npm.cmd run start:lan
```

## Cau truc du an

```text
App.tsx             Component chinh cua ung dung
index.ts            Entry point dang ky app voi Expo
app.json            Cau hinh Expo app
assets/             Anh icon, favicon va cac asset mac dinh
package.json        Dependencies va scripts
package-lock.json   Lockfile cua npm
tsconfig.json       Cau hinh TypeScript
.gitignore          Danh sach file va thu muc khong dua len Git
```

## Ghi chu Git

Khong nen dua cac file sau len Git:

- `node_modules/`
- `.expo/`
- `.claude/`
- `.env`
- `.env.*`
- build output nhu `dist/`, `web-build/`, `ios/`, `android/`

Da cau hinh trong `.gitignore` de tranh push nham cac file nay.
