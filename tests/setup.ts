import { beforeAll } from "vitest";
import i18n from "@/i18n";

// Component tests render real react-i18next hooks; init vi (default) để text
// assertion hiện có không đổi cho tới khi từng màn hình được migrate.
beforeAll(async () => {
  await i18n.changeLanguage("vi");
});
