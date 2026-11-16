import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode, Children, forwardRef } from "react";
import { Text as NativeText, TextInput as NativeTextInput, Pressable as NativePressable, type TextProps, type TextInputProps, type PressableProps } from "react-native";
import * as SecureStore from "@/services/deviceStorage";
import { assistantText, getAssistantLocale, normalizeAssistantLocale, setAssistantLocale, subscribeAssistantLocale, type AssistantLocale } from "./assistantLanguage";
const Locale = createContext<AssistantLocale | undefined>(undefined);
export const useAssistantLocale = () => useContext(Locale) ?? getAssistantLocale();
export const useAssistantText = () => { const locale = useAssistantLocale(); return (text: string) => assistantText(text, locale); };
export function AssistantLocaleProvider({ locale, children }: { locale: AssistantLocale; children: ReactNode }) { return <Locale.Provider value={locale}>{children}</Locale.Provider>; }
export function useAssistantLanguagePreference() {
  const locale = useSyncExternalStore(subscribeAssistantLocale, getAssistantLocale, getAssistantLocale);
  useEffect(() => { void SecureStore.getItemAsync("movevn_assistant_locale").then(value => { const stored = normalizeAssistantLocale(value); if (stored) setAssistantLocale(stored); }).catch(() => undefined); }, []);
  return [locale, (value: AssistantLocale) => { setAssistantLocale(value); void SecureStore.setItemAsync("movevn_assistant_locale", value).catch(() => undefined); }] as const;
}
export function Text({ children, ...props }: TextProps) {
  const t = useAssistantText();
  return <NativeText {...props}>{Children.map(children, child => typeof child === "string" ? t(child) : child)}</NativeText>;
}
export const TextInput = forwardRef<import("react").ComponentRef<typeof NativeTextInput>, TextInputProps>(function AssistantInput(props, ref) {
  const t = useAssistantText();
  return <NativeTextInput {...props} ref={ref} placeholder={props.placeholder ? t(props.placeholder) : undefined} accessibilityLabel={props.accessibilityLabel ? t(props.accessibilityLabel) : undefined} />;
});
export function Pressable(props: PressableProps) {
  const t = useAssistantText();
  return <NativePressable {...props} aria-checked={props["aria-checked"] ?? props.accessibilityState?.checked} accessibilityRole={props.accessibilityRole ?? "button"} accessibilityLabel={props.accessibilityLabel ? t(props.accessibilityLabel) : undefined} />;
}
