import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, ScrollView, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Card, SwipeDirection } from '../../types';
import SwipeOverlay from './SwipeOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_X_THRESHOLD = SCREEN_WIDTH * 0.3;
const SWIPE_Y_THRESHOLD = SCREEN_HEIGHT * 0.15;
const FLY_OFF_DISTANCE = SCREEN_WIDTH * 1.5;
const FLY_OFF_Y_DISTANCE = SCREEN_HEIGHT * 0.8;

interface SwipeCardProps {
  card: Card;
  onSwipe: (direction: SwipeDirection) => void;
  isTop: boolean;
  index: number;
}

export default function SwipeCard({ card, onSwipe, isTop, index }: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);

  const handleSwipe = (direction: SwipeDirection) => {
    onSwipe(direction);
  };

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const absX = Math.abs(translateX.value);
      const absY = Math.abs(translateY.value);

      // Check vertical (up = easy) first since it's more intentional
      if (translateY.value < -SWIPE_Y_THRESHOLD && absY > absX) {
        translateY.value = withTiming(-FLY_OFF_Y_DISTANCE, { duration: 300 });
        translateX.value = withTiming(translateX.value * 1.5, { duration: 300 });
        runOnJS(handleSwipe)('up');
        return;
      }

      // Check horizontal
      if (absX > SWIPE_X_THRESHOLD) {
        const direction: SwipeDirection = translateX.value > 0 ? 'right' : 'left';
        const targetX = translateX.value > 0 ? FLY_OFF_DISTANCE : -FLY_OFF_DISTANCE;
        translateX.value = withTiming(targetX, { duration: 300 });
        translateY.value = withTiming(translateY.value * 1.5, { duration: 300 });
        runOnJS(handleSwipe)(direction);
        return;
      }

      // Snap back
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-15, 0, 15]);

    if (isTop) {
      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { rotate: `${rotate}deg` },
        ],
      };
    }

    // Stacked cards: scale up as top card moves away
    const progress = Math.min(
      1,
      (Math.abs(translateX.value) + Math.abs(translateY.value)) / SWIPE_X_THRESHOLD
    );
    const scale = interpolate(progress, [0, 1], [1 - index * 0.05, 1 - (index - 1) * 0.05]);
    const yOffset = interpolate(progress, [0, 1], [index * 8, (index - 1) * 8]);

    return {
      transform: [{ scale }, { translateY: yOffset }],
    };
  });

  // Only the top card's translateX/Y are meaningful for overlay
  // but we pass them through for stacked cards too (overlay won't show since values are 0)

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { zIndex: 10 - index },
        cardAnimatedStyle,
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View style={styles.card}>
          <SwipeOverlay translateX={translateX} translateY={translateY} />
          <Pressable
            onPress={() => setFlipped(!flipped)}
            style={styles.cardContent}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {!flipped ? (
                <View style={styles.sideContainer}>
                  <Text style={styles.sideLabel}>FRONT</Text>
                  <Text style={styles.cardText}>{card.front}</Text>
                  <Text style={styles.tapHint}>Tap to flip</Text>
                </View>
              ) : (
                <View style={styles.sideContainer}>
                  <Text style={styles.sideLabel}>BACK</Text>
                  <Text style={styles.cardText}>{card.back}</Text>
                  <Text style={styles.tapHint}>Swipe to rate</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.55,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardContent: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  sideContainer: {
    alignItems: 'center',
    gap: 16,
  },
  sideLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#9ca3af',
  },
  cardText: {
    fontSize: 22,
    fontWeight: '500',
    textAlign: 'center',
    color: '#1f2937',
    lineHeight: 32,
  },
  tapHint: {
    fontSize: 13,
    color: '#d1d5db',
    marginTop: 8,
  },
});
