import { beforeAll } from "vitest";
import i18n from "@/i18n";

// Metro/Expo đặt __DEV__ toàn cục; một số module (expo async-require) đọc biến này
// ngay khi import nên phải có trước khi test file được nạp.
(globalThis as { __DEV__?: boolean }).__DEV__ = true;

// Component tests render real react-i18next hooks; init vi (default) để text
// assertion hiện có không đổi cho tới khi từng màn hình được migrate.
beforeAll(async () => {
  await i18n.changeLanguage("vi");
});
