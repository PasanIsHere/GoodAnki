import React, { useImperativeHandle, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Card, SwipeDirection } from '../../types';
import SwipeOverlay from './SwipeOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export const CARD_WIDTH = Math.min(SCREEN_WIDTH - 24, 460);
export const CARD_HEIGHT = Math.min(SCREEN_HEIGHT * 0.62, 540);
const SWIPE_X_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_Y_THRESHOLD = SCREEN_HEIGHT * 0.12;
const FLY_OFF_X = SCREEN_WIDTH * 1.6;
const FLY_OFF_Y = SCREEN_HEIGHT * 0.9;

export interface SwipeCardHandle {
  swipe: (direction: SwipeDirection) => void;
}

interface SwipeCardProps {
  card: Card;
  onSwipe: (direction: SwipeDirection) => void;
  isTop: boolean;
  index: number;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function hasMedia(text: string): boolean {
  return /<img\s|<audio\s/i.test(text);
}

function cardFontSize(plain: string): number {
  const len = plain.length;
  if (len <= 4) return 52;
  if (len <= 10) return 38;
  if (len <= 30) return 26;
  if (len <= 80) return 20;
  if (len <= 200) return 17;
  return 14;
}

function extractImages(html: string): string[] {
  const imgs: string[] = [];
  const re = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) imgs.push(m[1]);
  return imgs;
}

function extractAudioSrc(html: string): string | null {
  const m = html.match(/<audio[^>]+src="([^"]+)"[^>]*>/i);
  return m ? m[1] : null;
}

// ── Content renderers ─────────────────────────────────────────────────────────

/** Web: full HTML rendered in a div with proper media CSS */
function WebContent({ html, fontSize }: { html: string; fontSize: number }) {
  const wrapped = `<style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}
    img{max-width:100%;height:auto;border-radius:10px;display:block;margin:8px auto}
    audio{width:100%;margin:10px 0;border-radius:8px}
    p,div{line-height:1.5}
  </style>${html}`;
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '20px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        fontSize: `${fontSize}px`,
        color: '#111827',
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: '1.5',
        wordBreak: 'break-word',
      }}
      // @ts-ignore
      dangerouslySetInnerHTML={{ __html: wrapped }}
    />
  );
}

/** Native: parse HTML, render Image components + audio chip + text */
function NativeContent({ html, fontSize }: { html: string; fontSize: number }) {
  const images = extractImages(html);
  const audioSrc = extractAudioSrc(html);
  const text = stripHtml(html);

  return (
    <ScrollView
      contentContainerStyle={richStyles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {images.map((src, i) => (
        <Image
          key={i}
          source={{ uri: src }}
          style={richStyles.image}
          resizeMode="contain"
        />
      ))}
      {audioSrc && (
        <View style={richStyles.audioChip}>
          <Text style={richStyles.audioIcon}>🔊</Text>
          <Text style={richStyles.audioText}>Audio</Text>
        </View>
      )}
      {text ? (
        <Text style={[richStyles.text, { fontSize, lineHeight: fontSize * 1.45 }]}>
          {text}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function CardContent({ text }: { text: string }) {
  const plain = hasMedia(text) ? stripHtml(text) : text;
  const fontSize = cardFontSize(plain);

  if (hasMedia(text)) {
    if (Platform.OS === 'web') return <WebContent html={text} fontSize={fontSize} />;
    return <NativeContent html={text} fontSize={fontSize} />;
  }
  return (
    <View style={styles.plainWrap}>
      <Text style={[styles.plainText, { fontSize, lineHeight: fontSize * 1.45 }]}>
        {text}
      </Text>
    </View>
  );
}

// ── SwipeCard ─────────────────────────────────────────────────────────────────

const SwipeCard = React.forwardRef<SwipeCardHandle, SwipeCardProps>(
  function SwipeCard({ card, onSwipe, isTop, index }, ref) {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const [flipped, setFlipped] = useState(false);

    useImperativeHandle(ref, () => ({
      swipe(direction: SwipeDirection) {
        if (direction === 'up') {
          translateY.value = withTiming(-FLY_OFF_Y, { duration: 280 });
          translateX.value = withTiming(0, { duration: 280 });
        } else {
          translateX.value = withTiming(
            direction === 'right' ? FLY_OFF_X : -FLY_OFF_X,
            { duration: 280 }
          );
          translateY.value = withTiming(translateY.value * 1.5, { duration: 280 });
        }
        // Delay state update to let animation play out
        setTimeout(() => onSwipe(direction), 260);
      },
    }));

    const panGesture = Gesture.Pan()
      .enabled(isTop)
      .onUpdate((e) => {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      })
      .onEnd(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);

        if (translateY.value < -SWIPE_Y_THRESHOLD && absY > absX) {
          translateY.value = withTiming(-FLY_OFF_Y, { duration: 280 });
          translateX.value = withTiming(translateX.value * 2, { duration: 280 });
          runOnJS(onSwipe)('up');
          return;
        }
        if (absX > SWIPE_X_THRESHOLD) {
          const dir: SwipeDirection = translateX.value > 0 ? 'right' : 'left';
          translateX.value = withTiming(
            translateX.value > 0 ? FLY_OFF_X : -FLY_OFF_X,
            { duration: 280 }
          );
          translateY.value = withTiming(translateY.value * 2, { duration: 280 });
          runOnJS(onSwipe)(dir);
          return;
        }
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      });

    const cardAnimStyle = useAnimatedStyle(() => {
      if (isTop) {
        const rotate = interpolate(
          translateX.value,
          [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
          [-16, 0, 16]
        );
        return {
          transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotate}deg` },
          ],
        };
      }
      const progress = Math.min(
        1,
        (Math.abs(translateX.value) + Math.abs(translateY.value)) / SWIPE_X_THRESHOLD
      );
      const scale = interpolate(
        progress,
        [0, 1],
        [1 - index * 0.045, 1 - (index - 1) * 0.045]
      );
      const yOffset = interpolate(progress, [0, 1], [index * 10, (index - 1) * 10]);
      return { transform: [{ scale }, { translateY: yOffset }] };
    });

    const displayText = flipped ? card.back : card.front;

    return (
      <Animated.View style={[styles.wrap, { zIndex: 10 - index }, cardAnimStyle]}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.card}>
            <SwipeOverlay translateX={translateX} translateY={translateY} />

            {/* Header label */}
            <View style={[styles.header, flipped && styles.headerAnswer]}>
              <View style={[styles.headerDot, flipped && styles.headerDotAnswer]} />
              <Text style={[styles.headerLabel, flipped && styles.headerLabelAnswer]}>
                {flipped ? 'ANSWER' : 'QUESTION'}
              </Text>
            </View>

            {/* Card content — tap to flip */}
            <Pressable
              onPress={() => isTop && setFlipped((f) => !f)}
              style={styles.contentArea}
            >
              <CardContent text={displayText} />
            </Pressable>

            {/* Footer hint */}
            <View style={styles.footer}>
              <Text style={styles.footerHint}>
                {flipped ? 'swipe to rate' : 'tap to flip'}
              </Text>
            </View>
          </View>
        </GestureDetector>
      </Animated.View>
    );
  }
);

export default SwipeCard;

// ── Styles ────────────────────────────────────────────────────────────────────

const richStyles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 14,
  },
  image: {
    width: CARD_WIDTH - 48,
    height: 200,
    borderRadius: 12,
  },
  audioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  audioIcon: { fontSize: 20 },
  audioText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  text: {
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fafbff',
  },
  headerAnswer: {
    backgroundColor: '#f0fdf4',
    borderBottomColor: '#dcfce7',
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#93c5fd',
  },
  headerDotAnswer: {
    backgroundColor: '#86efac',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#93c5fd',
  },
  headerLabelAnswer: {
    color: '#4ade80',
  },
  contentArea: {
    flex: 1,
  },
  plainWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  plainText: {
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 13,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerHint: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
