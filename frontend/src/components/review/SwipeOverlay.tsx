import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

interface SwipeOverlayProps {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const THRESHOLD = 60;

export default function SwipeOverlay({ translateX, translateY }: SwipeOverlayProps) {
  const againStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -THRESHOLD], [0, 1], 'clamp'),
  }));
  const goodStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, THRESHOLD], [0, 1], 'clamp'),
  }));
  const easyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, -THRESHOLD], [0, 1], 'clamp'),
  }));

  return (
    <>
      {/* AGAIN — top-left, tilted counter-clockwise */}
      <Animated.View
        style={[styles.overlayBase, styles.overlayAgain, againStyle]}
        pointerEvents="none"
      >
        <View style={[styles.badge, styles.badgeAgain]}>
          <Text style={[styles.label, styles.labelAgain]}>AGAIN</Text>
        </View>
      </Animated.View>

      {/* GOOD — top-right, tilted clockwise */}
      <Animated.View
        style={[styles.overlayBase, styles.overlayGood, goodStyle]}
        pointerEvents="none"
      >
        <View style={[styles.badge, styles.badgeGood]}>
          <Text style={[styles.label, styles.labelGood]}>GOOD</Text>
        </View>
      </Animated.View>

      {/* EASY — top-center */}
      <Animated.View
        style={[styles.overlayBase, styles.overlayEasy, easyStyle]}
        pointerEvents="none"
      >
        <View style={[styles.badge, styles.badgeEasy]}>
          <Text style={[styles.label, styles.labelEasy]}>EASY</Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlayBase: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    zIndex: 20,
  },
  // Each overlay has its own bg tint + badge alignment
  overlayAgain: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 20,
  },
  overlayGood: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 20,
  },
  overlayEasy: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  badgeAgain: {
    borderColor: '#ef4444',
    transform: [{ rotate: '-12deg' }],
  },
  badgeGood: {
    borderColor: '#22c55e',
    transform: [{ rotate: '12deg' }],
  },
  badgeEasy: {
    borderColor: '#3b82f6',
  },
  label: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  labelAgain: { color: '#ef4444' },
  labelGood: { color: '#22c55e' },
  labelEasy: { color: '#3b82f6' },
});
