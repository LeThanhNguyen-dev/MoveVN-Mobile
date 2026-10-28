import type { Theme } from "./tokens";

/** Shared dimensions: grow with content; never use fixed heights for text. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 28 } as const;
export const radius = { sm: 10, control: 14, card: 20, sheet: 24, pill: 999 } as const;
export const size = { touch: 44, control: 48, icon: 20, avatar: 44 } as const;
export const typeScale = {
  caption: { fontSize: 12, lineHeight: 18 },
  label: { fontSize: 13, lineHeight: 20, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 22 },
  section: { fontSize: 18, lineHeight: 26, fontWeight: "700" },
  title: { fontSize: 23, lineHeight: 32, fontWeight: "700" },
  amount: { fontSize: 28, lineHeight: 38, fontWeight: "700" },
} as const;

export function surfaceStyle(theme: Theme) {
  return {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: radius.card,
  } as const;
}

export function contentStyle() {
  return { padding: space.lg, paddingBottom: space.section, gap: space.lg } as const;
}
