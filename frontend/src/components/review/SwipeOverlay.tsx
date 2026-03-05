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

const THRESHOLD = 80;

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
      <Animated.View style={[styles.overlay, styles.againOverlay, againStyle]} pointerEvents="none">
        <View style={[styles.badge, styles.againBadge]}>
          <Text style={[styles.label, styles.againLabel]}>AGAIN</Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.overlay, styles.goodOverlay, goodStyle]} pointerEvents="none">
        <View style={[styles.badge, styles.goodBadge]}>
          <Text style={[styles.label, styles.goodLabel]}>GOOD</Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.overlay, styles.easyOverlay, easyStyle]} pointerEvents="none">
        <View style={[styles.badge, styles.easyBadge]}>
          <Text style={[styles.label, styles.easyLabel]}>EASY</Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  againOverlay: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  goodOverlay: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  easyOverlay: { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
  badge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 3,
  },
  againBadge: { borderColor: '#ef4444', backgroundColor: 'rgba(255,255,255,0.9)' },
  goodBadge: { borderColor: '#22c55e', backgroundColor: 'rgba(255,255,255,0.9)' },
  easyBadge: { borderColor: '#3b82f6', backgroundColor: 'rgba(255,255,255,0.9)' },
  label: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  againLabel: { color: '#ef4444' },
  goodLabel: { color: '#22c55e' },
  easyLabel: { color: '#3b82f6' },
});
