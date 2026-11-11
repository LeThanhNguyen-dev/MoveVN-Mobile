import i18n from "@/i18n";

/**
 * Label map khai báo ở module scope không được dịch một lần lúc import: giá trị sẽ
 * đóng băng theo ngôn ngữ lúc module load và không đổi khi app chuyển ngôn ngữ.
 * Các helper dưới đây resolve bản dịch mỗi lần đọc thuộc tính.
 */
export function translatedLabels<T extends string>(ns: string, keys: Record<T, string>): Record<T, string> {
  const result = {} as Record<T, string>;
  (Object.entries(keys) as [T, string][]).forEach(([code, key]) => {
    Object.defineProperty(result, code, { get: () => i18n.t(key, { ns }), enumerable: true });
  });
  return result;
}

/** Option item có label theo ngôn ngữ hiện tại ở mỗi lần đọc. */
export function localizedOption(value: string, ns: string, key: string, defaultValue?: string) {
  return {
    value,
    get label() {
      return i18n.t(key, { ns, defaultValue });
    },
  };
}
