import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";

export default function BookingDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  return <View style={{ borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title} onPress={() => setOpen(value => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 16 }}>
      <Text style={{ flex: 1, color: theme.text, fontSize: 14, fontFamily: font.semibold }}>{title}</Text>
      {open ? <ChevronUp color={theme.brand} size={18} /> : <ChevronDown color={theme.brand} size={18} />}
    </Pressable>
    {open && <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View>}
  </View>;
}
