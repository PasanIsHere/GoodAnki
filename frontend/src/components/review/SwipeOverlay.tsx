import React from 'react';
import { StyleSheet, Text } from 'react-native';
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
        <Text style={[styles.label, styles.againLabel]}>AGAIN</Text>
      </Animated.View>
      <Animated.View style={[styles.overlay, styles.goodOverlay, goodStyle]} pointerEvents="none">
        <Text style={[styles.label, styles.goodLabel]}>GOOD</Text>
      </Animated.View>
      <Animated.View style={[styles.overlay, styles.easyOverlay, easyStyle]} pointerEvents="none">
        <Text style={[styles.label, styles.easyLabel]}>EASY</Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  againOverlay: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  goodOverlay: {
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
  },
  easyOverlay: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  label: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 2,
  },
  againLabel: {
    color: '#ef4444',
  },
  goodLabel: {
    color: '#22c55e',
  },
  easyLabel: {
    color: '#3b82f6',
  },
});
