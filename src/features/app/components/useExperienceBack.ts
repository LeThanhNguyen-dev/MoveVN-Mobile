import { useEffect } from "react";
import { BackHandler } from "react-native";

export default function useExperienceBack(active: boolean, onBack: () => void) {
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [active, onBack]);
}
