import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";

export function AuthLayout({ children }: { children: ReactNode }) {
  return <View style={styles.frame}>
    <View pointerEvents="none" style={styles.background}>
      <View style={styles.routeOne} />
      <View style={styles.routeTwo} />
    </View>
    <View style={styles.content}>
      <View style={styles.brand}>
        <Image accessibilityLabel="MoveVN" resizeMode="contain" source={require("../../../../Logo/logo-noslogan-ligh.png")} style={styles.logo} />
      </View>
      {children}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  background: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  routeOne: { position: "absolute", width: 420, height: 190, top: 116, left: -160, borderWidth: 2, borderColor: "#E2CCFF", borderRadius: 130, transform: [{ rotate: "-16deg" }] },
  routeTwo: { position: "absolute", width: 460, height: 230, bottom: 92, right: -220, borderWidth: 2, borderColor: "#F3CBE5", borderRadius: 160, transform: [{ rotate: "22deg" }] },
  content: { flex: 1, width: "100%", maxWidth: 440, alignSelf: "center", paddingHorizontal: 24, paddingTop: 26, paddingBottom: 32, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: 34 },
  logo: { width: 190, height: 64 },
});
