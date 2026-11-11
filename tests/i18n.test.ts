import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { getFormatLocale } from "@/i18n/formatLocale";
import { localeModules } from "@/i18n/resources";

const enAppSettings = (localeModules.en as Record<string, Record<string, unknown>>)["app/settings.json"];

afterEach(async () => {
  await i18n.changeLanguage("vi");
});

describe("i18n resources", () => {
  it("merges the mobile-only app namespace into both languages", () => {
    expect(i18n.getFixedT("vi")("app:language.label")).toBe("Ngôn ngữ");
    expect(i18n.getFixedT("en")("app:language.label")).toBe("Language");
    expect(i18n.getFixedT("en")("app:startup.retry")).toBe("Try again");
  });

  it("keeps common as the default namespace and deep-merges synced web files", () => {
    expect(i18n.getFixedT("vi")("notifications.categories.support")).toBe("Hỗ trợ");
    expect(i18n.getFixedT("en")("notifications.categories.support")).toBe("Support");
    expect(i18n.getFixedT("en")("notifications.justNow")).toBe("Just now");
  });

  it("falls back to vi when a key is missing in en", async () => {
    i18n.removeResourceBundle("en", "app");
    expect(i18n.getFixedT("en")("app:startup.retry")).toBe("Thử lại");
    i18n.addResourceBundle("en", "app", enAppSettings);
    expect(i18n.getFixedT("en")("app:startup.retry")).toBe("Try again");
  });

  it("reports the Intl format locale matching the active language", async () => {
    expect(getFormatLocale()).toBe("vi-VN");
    await i18n.changeLanguage("en");
    expect(getFormatLocale()).toBe("en-US");
  });
});
