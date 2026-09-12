import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const TOUCH = 20;
const DOT = 20;
const PAD = 10;
const TRACK_H = 28;

function snap(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  return Math.round(clamped / step) * step;
}

type DragCallback = (dragging: boolean) => void;

function useThumbPan(
  onGrant: () => void,
  onMove: (dx: number) => void,
  onEnd: () => void,
) {
  const refs = useRef({ grant: onGrant, move: onMove, end: onEnd });
  refs.current = { grant: onGrant, move: onMove, end: onEnd };
  return useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => refs.current.grant(),
      onPanResponderMove: (_, g) => refs.current.move(g.dx),
      onPanResponderRelease: () => refs.current.end(),
      onPanResponderTerminate: () => refs.current.end(),
    }),
  ).current;
}

export function DualRangeSlider({
  min,
  max,
  step,
  low,
  high,
  onLowChange,
  onHighChange,
  onDragStateChange,
}: {
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  onLowChange: (v: number) => void;
  onHighChange: (v: number) => void;
  onDragStateChange?: DragCallback;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [trackWidth, setTrackWidth] = useState(0);

  const live = useRef({ low, high, width: 0, min, max, step });
  live.current = { low, high, width: trackWidth > 0 ? trackWidth : 1, min, max, step };
  const cb = useRef({ low: onLowChange, high: onHighChange, drag: onDragStateChange });
  cb.current = { low: onLowChange, high: onHighChange, drag: onDragStateChange };

  const range = max - min || 1;
  const lowPos = ((low - min) / range) * trackWidth;
  const highPos = ((high - min) / range) * trackWidth;

  const startLow = useRef(0);
  const startHigh = useRef(0);

  const lowPan = useThumbPan(
    () => {
      startLow.current = live.current.low;
      cb.current.drag?.(true);
    },
    (dx) => {
      const s = live.current;
      cb.current.low(snap(startLow.current + (dx / s.width) * (s.max - s.min), s.min, s.high, s.step));
    },
    () => cb.current.drag?.(false),
  );

  const highPan = useThumbPan(
    () => {
      startHigh.current = live.current.high;
      cb.current.drag?.(true);
    },
    (dx) => {
      const s = live.current;
      cb.current.high(snap(startHigh.current + (dx / s.width) * (s.max - s.min), s.low, s.max, s.step));
    },
    () => cb.current.drag?.(false),
  );

  function handleTap(x: number) {
    const s = live.current;
    if (s.width <= 0) return;
    const value = snap(s.min + (x / s.width) * (s.max - s.min), s.min, s.max, s.step);
    if (Math.abs(value - s.low) <= Math.abs(value - s.high)) {
      cb.current.low(Math.min(value, s.high));
    } else {
      cb.current.high(Math.max(value, s.low));
    }
  }

  return (
    <View style={styles.sliderBox}>
      <View style={styles.pad}>
        <Pressable style={styles.trackHit} onPress={(e) => handleTap(e.nativeEvent.locationX)}>
          <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
            <View style={[styles.fill, { left: lowPos, width: Math.max(highPos - lowPos, 0) }]} />
          </View>
        </Pressable>
      </View>
      <View
        style={[styles.thumb, { left: PAD + lowPos - TOUCH / 2 }]}
        {...lowPan.panHandlers}
      >
        <View style={styles.thumbDot} />
      </View>
      <View
        style={[styles.thumb, { left: PAD + highPos - TOUCH / 2 }]}
        {...highPan.panHandlers}
      >
        <View style={styles.thumbDot} />
      </View>
    </View>
  );
}

export function SingleSlider({
  min,
  max,
  step,
  value,
  onChange,
  onDragStateChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  onDragStateChange?: DragCallback;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [trackWidth, setTrackWidth] = useState(0);

  const live = useRef({ value, width: 0, min, max, step });
  live.current = { value, width: trackWidth > 0 ? trackWidth : 1, min, max, step };
  const cb = useRef({ fn: onChange, drag: onDragStateChange });
  cb.current = { fn: onChange, drag: onDragStateChange };

  const range = max - min || 1;
  const pos = ((value - min) / range) * trackWidth;
  const startValue = useRef(0);

  const pan = useThumbPan(
    () => {
      startValue.current = live.current.value;
      cb.current.drag?.(true);
    },
    (dx) => {
      const s = live.current;
      cb.current.fn(snap(startValue.current + (dx / s.width) * (s.max - s.min), s.min, s.max, s.step));
    },
    () => cb.current.drag?.(false),
  );

  function handleTap(x: number) {
    const s = live.current;
    if (s.width <= 0) return;
    cb.current.fn(snap(s.min + (x / s.width) * (s.max - s.min), s.min, s.max, s.step));
  }

  return (
    <View style={styles.sliderBox}>
      <View style={styles.pad}>
        <Pressable style={styles.trackHit} onPress={(e) => handleTap(e.nativeEvent.locationX)}>
          <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
            <View style={[styles.fill, { left: 0, width: Math.max(pos, 0) }]} />
          </View>
        </Pressable>
      </View>
      <View style={[styles.thumb, { left: PAD + pos - TOUCH / 2 }]} {...pan.panHandlers}>
        <View style={styles.thumbDot} />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    pad: { paddingHorizontal: PAD },
    sliderBox: { height: TRACK_H, justifyContent: "center" },
    trackHit: { justifyContent: "center", height: TRACK_H },
    track: { height: 6, borderRadius: 3, backgroundColor: theme.surfaceAlt },
    fill: {
      position: "absolute",
      top: 0,
      bottom: 0,
      borderRadius: 3,
      backgroundColor: theme.brand,
    },
    thumb: {
      position: "absolute",
      top: (TRACK_H - TOUCH) / 2,
      width: TOUCH,
      height: TOUCH,
      alignItems: "center",
      justifyContent: "center",
    },
    thumbDot: {
      width: DOT,
      height: DOT,
      borderRadius: DOT / 2,
      backgroundColor: theme.surface,
      borderWidth: 3,
      borderColor: theme.brand,
    },
  });

export function SliderCaption({ left, right }: { left: string; right: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
      <Text style={{ color: theme.faint, fontSize: 10, fontWeight: "600" }}>{left}</Text>
      <Text style={{ color: theme.faint, fontSize: 10, fontWeight: "600" }}>{right}</Text>
    </View>
  );
}
