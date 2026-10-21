export function goBackOrFallback(
  navigation: { canGoBack: () => boolean; goBack: () => void },
  fallback: () => void,
) {
  if (navigation.canGoBack()) navigation.goBack();
  else fallback();
}
