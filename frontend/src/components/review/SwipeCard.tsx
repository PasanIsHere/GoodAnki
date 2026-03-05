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

/** Pick a font size that fits the content well. */
function cardFontSize(text: string): number {
  const len = text.length;
  if (len <= 6) return 48;   // Chinese characters, single words
  if (len <= 20) return 30;
  if (len <= 60) return 22;
  if (len <= 150) return 18;
  return 15;
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
    .onEnd(() => {
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

  const displayText = flipped ? card.back : card.front;
  const fontSize = cardFontSize(displayText);

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { zIndex: 10 - index },
        cardAnimatedStyle,
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, flipped && styles.cardFlipped]}>
          <SwipeOverlay translateX={translateX} translateY={translateY} />
          <Pressable
            onPress={() => isTop && setFlipped(!flipped)}
            style={styles.cardContent}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={isTop}
            >
              {!flipped ? (
                <View style={styles.sideContainer}>
                  <View style={styles.sideLabelRow}>
                    <Text style={styles.sideLabel}>QUESTION</Text>
                  </View>
                  <Text style={[styles.cardText, { fontSize }]}>{card.front}</Text>
                  <View style={styles.tapHintRow}>
                    <Text style={styles.tapHint}>Tap to reveal answer</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.sideContainer}>
                  <View style={[styles.sideLabelRow, styles.answerLabelRow]}>
                    <Text style={[styles.sideLabel, styles.answerLabel]}>ANSWER</Text>
                  </View>
                  <Text style={[styles.cardText, { fontSize }]}>{card.back}</Text>
                  <View style={styles.tapHintRow}>
                    <Text style={styles.tapHint}>Swipe to rate</Text>
                  </View>
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
    height: SCREEN_HEIGHT * 0.58,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e8f0fe',
  },
  cardFlipped: {
    borderColor: '#d1fae5',
    shadowColor: '#22c55e',
    shadowOpacity: 0.1,
  },
  cardContent: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  sideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sideLabelRow: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    alignItems: 'flex-start',
  },
  answerLabelRow: {
    borderBottomColor: '#d1fae5',
  },
  sideLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#93c5fd',
  },
  answerLabel: {
    color: '#6ee7b7',
  },
  cardText: {
    fontWeight: '500',
    textAlign: 'center',
    color: '#1f2937',
    lineHeight: undefined,
    flex: 1,
    textAlignVertical: 'center',
    paddingVertical: 16,
  },
  tapHintRow: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  tapHint: {
    fontSize: 12,
    color: '#d1d5db',
    fontWeight: '500',
  },
});
