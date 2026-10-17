import { useState } from "react";
import { Image } from "react-native";
import { inspectionImageUrl } from "../inspectionImageUrl";

// Use the image's own ratio so every photo fills the available width,
// including its timestamp, without leaving a fixed-size empty frame.
export default function InspectionPhoto({ uri, label }: { uri: string; label: string }) {
  const [ratio, setRatio] = useState(3 / 4);
  const [fallback, setFallback] = useState(false);
  return <Image
    accessibilityLabel={label}
    source={{ uri: fallback ? uri : inspectionImageUrl(uri) }}
    resizeMode="contain"
    onLoad={({ nativeEvent }) => {
      const { width, height } = nativeEvent.source;
      if (width > 0 && height > 0) setRatio(width / height);
    }}
    onError={() => setFallback(true)}
    style={{ width: "100%", aspectRatio: ratio, borderRadius: 8 }}
  />;
}
