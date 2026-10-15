import { useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { sanitizeCmsHtml } from "@/features/cms/utils/sanitize";
import { useTheme } from "@/theme/useTheme";

const HEIGHT_SCRIPT = `(function() {
  function postHeight() {
    try {
      var h = Math.max(
        document.documentElement ? document.documentElement.scrollHeight : 0,
        document.body ? document.body.scrollHeight : 0
      );
      window.ReactNativeWebView.postMessage(String(Math.ceil(h)));
    } catch (e) {}
  }
  function watchImages() {
    try {
      Array.prototype.forEach.call(document.images, function (img) {
        if (!img.__cmsWatched) {
          img.__cmsWatched = true;
          img.addEventListener('load', postHeight);
          img.addEventListener('error', postHeight);
        }
      });
    } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', function () { postHeight(); watchImages(); });
  window.addEventListener('load', function () { postHeight(); watchImages(); });
  try {
    new MutationObserver(function () { postHeight(); watchImages(); })
      .observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  } catch (e) {}
  postHeight();
  watchImages();
  setTimeout(postHeight, 1000);
  true;
})();`;

const IMAGE_TAP_SCRIPT = `(function() {
  document.addEventListener('click', function (e) {
    var el = e.target;
    var img = el && el.closest ? el.closest('img') : null;
    if (!img) return;
    if (img.closest('a')) return;
    var src = img.getAttribute('src') || img.src || '';
    if (!src) return;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cms-image', src: src })); } catch (err) {}
  }, true);
  true;
})();`;

function buildDocument(bodyHtml: string, textColor: string, mutedColor: string, brandColor: string, borderColor: string, fontSize: number) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />`
    + `<style>html,body{margin:0;padding:0;background:transparent;}`
    + `body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;`
    + `font-size:${fontSize}px;line-height:1.65;color:${textColor};word-wrap:break-word;overflow-wrap:anywhere;}`
    + `p{margin:0 0 10px;}p:last-child{margin-bottom:0;}`
    + `h1,h2,h3,h4{color:${textColor};line-height:1.4;margin:12px 0 8px;font-weight:800;}`
    + `h1{font-size:18px;}h2{font-size:16px;}h3{font-size:15px;}h4{font-size:14px;}`
    + `ul,ol{margin:0 0 10px;padding-left:22px;}li{margin:2px 0;}`
    + `a{color:${brandColor};}`
    + `img{max-width:100%;height:auto;border-radius:8px;margin:8px 0;display:block;}`
    + `figure{margin:8px 0;}figcaption{font-size:12px;color:${mutedColor};text-align:center;}`
    + `blockquote{margin:8px 0;padding:8px 12px;border-left:3px solid ${brandColor};color:${mutedColor};}`
    + `table{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px;}`
    + `th,td{border:1px solid ${borderColor};padding:6px 8px;text-align:left;}`
    + `hr{border:none;border-top:1px solid ${borderColor};margin:12px 0;}`
    + `</style></head><body>${bodyHtml}</body></html>`;
}

/**
 * Renders sanitized CMS rich HTML (text, images, tables, links) inside an
 * auto-height WebView — the mobile equivalent of web `SectionRenderer`
 * (`dangerouslySetInnerHTML` + DOMPurify). Links open externally.
 */
export default function CmsHtmlView({
  html,
  fontSize = 14,
  onImagePress,
}: {
  html: string;
  fontSize?: number;
  onImagePress?: (url: string) => void;
}) {
  const { theme } = useTheme();
  const webRef = useRef<WebView>(null);
  const [height, setHeight] = useState(48);

  const document = useMemo(
    () => buildDocument(sanitizeCmsHtml(html), theme.text, theme.muted, theme.brand, theme.border, fontSize),
    [html, theme, fontSize],
  );

  function handleMessage(event: WebViewMessageEvent) {
    const data = event.nativeEvent.data;
    if (typeof data === "string" && data.charAt(0) === "{") {
      try {
        const message = JSON.parse(data) as { type?: unknown; src?: unknown };
        if (
          message.type === "cms-image" &&
          typeof message.src === "string" &&
          /^https?:/i.test(message.src)
        ) {
          onImagePress?.(message.src);
          return;
        }
      } catch {
        // Not a JSON message: fall through to height handling below.
      }
    }
    const next = Number(data);
    if (Number.isFinite(next) && next > 0 && Math.abs(next - height) >= 1) {
      setHeight(Math.min(next, 4000));
    }
  }

  function handleShouldStartLoad(request: ShouldStartLoadRequest) {
    const url = request.url ?? "";
    if (url === "about:blank") return true;
    if (/^(https?:|mailto:|tel:)/i.test(url) && request.navigationType === "click") {
      void Linking.openURL(url);
      return false;
    }
    return request.navigationType !== "click";
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html: document }}
        style={[styles.webview, { height }]}
        containerStyle={styles.webviewContainer}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        injectedJavaScript={onImagePress ? `${HEIGHT_SCRIPT}\n${IMAGE_TAP_SCRIPT}` : HEIGHT_SCRIPT}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  webview: { width: "100%", backgroundColor: "transparent" },
  webviewContainer: { backgroundColor: "transparent" },
});
