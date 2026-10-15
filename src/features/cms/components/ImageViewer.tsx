import { Image, type ImageSource } from "expo-image";
import { useEffect, useState } from "react";
import { X } from "lucide-react-native";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Fullscreen image viewer rendered as an overlay Modal: the underlying page
 * (scroll position, accordion state) is preserved. Supports pinch-to-zoom
 * via ScrollView zoom scales, an explicit close button and Android Back
 * (Modal `onRequestClose`). No new business logic or routes are added.
 */
export default function ImageViewer({
  source,
  title,
  onClose,
}: {
  source: ImageSource | null;
  title: string;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (source) {
      setLoading(true);
      setFailed(false);
    }
  }, [source]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent={false}
    visible={source !== null}
  >
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Text numberOfLines={1} style={styles.topBarTitle}>
            {title}
          </Text>
          <Pressable
            accessibilityLabel="Đóng xem ảnh"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeButton}
          >
            <X color="#FFFFFF" size={22} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={styles.stage}>
          {source ? (
            <ScrollView
              contentContainerStyle={styles.zoomContent}
              maximumZoomScale={4}
              minimumZoomScale={1}
              pinchGestureEnabled
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={styles.zoom}
            >
              <Image
                accessibilityLabel={title}
                contentFit="contain"
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
                onLoadEnd={() => setLoading(false)}
                source={source}
                style={{ width, height: height - 160 }}
                transition={200}
              />
            </ScrollView>
          ) : null}

          {loading && !failed ? (
            <View pointerEvents="none" style={styles.centerOverlay}>
              <ActivityIndicator color="#FFFFFF" size="large" />
            </View>
          ) : null}

          {failed ? (
            <View pointerEvents="none" style={styles.centerOverlay}>
              <Text style={styles.errorText}>Không tải được ảnh.</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000000" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 52,
  },
  topBarTitle: { flex: 1, minWidth: 0, color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  stage: { flex: 1, position: "relative" },
  zoom: { flex: 1 },
  zoomContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  centerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});
