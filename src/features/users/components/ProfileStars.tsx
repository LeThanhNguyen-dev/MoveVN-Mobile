import { Star } from "lucide-react-native";
import { memo } from "react";
import { StyleSheet, View } from "react-native";

type ProfileStarsProps = {
  rating: number | null;
  size?: number;
};

/** Hàng sao đánh giá (mirror web Stars): sao đầy màu hổ phách, sao rỗng xám. */
function ProfileStars({ rating, size = 14 }: ProfileStarsProps) {
  const filled = Math.max(0, Math.min(5, Math.round(rating ?? 0)));
  return (
    <View style={styles.row} accessibilityLabel={`${filled} trên 5 sao`}>
      {[0, 1, 2, 3, 4].map((index) => (
        <Star
          key={index}
          size={size}
          color={index < filled ? "#FBBF24" : "#D4D4D8"}
          fill={index < filled ? "#FBBF24" : "transparent"}
        />
      ))}
    </View>
  );
}

export default memo(ProfileStars);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
});
