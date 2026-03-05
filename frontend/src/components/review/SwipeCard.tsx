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

/** Strip HTML to plain text, preserving newlines and removing style/script content. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(div|p|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** True if the text contains any HTML tags (needs HTML rendering). */
function hasHtml(text: string): boolean {
  return /<[a-z]/i.test(text);
}

function cardFontSize(len: number): number {
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

/** Pull the first <audio> src out of html, returning cleaned html and the src. */
function extractAudio(html: string): { src: string | null; html: string } {
  let src: string | null = null;
  const cleaned = html.replace(/<audio[^>]+src="([^"]+)"[^>]*>(?:<\/audio>)?/gi, (_, s) => {
    if (!src) src = s;
    return '';
  });
  return { src, html: cleaned };
}

// ── Content renderers ─────────────────────────────────────────────────────────

/** Web: HTML rendered with proper spacing and hierarchy */
function WebContent({ html }: { html: string }) {
  const wrapped = `<style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}
    body{white-space:pre-line;word-break:break-word}
    img{max-width:100%;height:auto;border-radius:10px;display:block;margin:12px auto}
    b,strong{font-weight:700;color:#111827}
    u{text-decoration:underline}
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
        padding: '24px 28px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        color: '#111827',
        textAlign: 'center',
        lineHeight: '1.6',
        wordBreak: 'break-word',
        whiteSpace: 'pre-line',
      }}
      // @ts-ignore
      dangerouslySetInnerHTML={{ __html: wrapped }}
    />
  );
}

/** Audio player — rendered outside the flip Pressable so controls work. */
function AudioPlayer({ src }: { src: string }) {
  if (Platform.OS === 'web') {
    return (
      // @ts-ignore
      <div style={{ padding: '0 24px 14px', width: '100%', boxSizing: 'border-box' }}>
        {/* @ts-ignore */}
        <audio controls src={src} style={{ width: '100%', borderRadius: 8 }} />
      </div>
    );
  }
  return (
    <View style={richStyles.audioChip}>
      <Text style={richStyles.audioIcon}>🔊</Text>
      <Text style={richStyles.audioText}>Audio clip</Text>
    </View>
  );
}

/** Native: images + text sections with visual hierarchy */
function NativeContent({ html }: { html: string }) {
  const images = extractImages(html);
  const rawText = htmlToText(html);
  const sections = rawText.split('\n').map(s => s.trim()).filter(Boolean);
  const mainSection = sections[0] ?? '';
  const details = sections.slice(1);
  const mainFontSize = cardFontSize(mainSection.length);

  return (
    <ScrollView contentContainerStyle={richStyles.scroll} showsVerticalScrollIndicator={false}>
      {images.map((imgSrc, i) => (
        <Image key={i} source={{ uri: imgSrc }} style={richStyles.image} resizeMode="contain" />
      ))}
      {mainSection ? (
        <Text style={[richStyles.mainText, { fontSize: mainFontSize, lineHeight: mainFontSize * 1.4 }]}>
          {mainSection}
        </Text>
      ) : null}
      {details.length > 0 && (
        <>
          <View style={richStyles.divider} />
          {details.map((line, i) => (
            <Text key={i} style={richStyles.detailText}>{line}</Text>
          ))}
        </>
      )}
    </ScrollView>
  );
}

/** Plain text with section hierarchy: first line big, rest as detail rows */
function PlainContent({ text }: { text: string }) {
  const sections = text.split('\n').map(s => s.trim()).filter(Boolean);
  if (sections.length === 0) return null;
  const mainSection = sections[0];
  const details = sections.slice(1);
  const mainFontSize = cardFontSize(mainSection.length);

  return (
    <ScrollView contentContainerStyle={richStyles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[richStyles.mainText, { fontSize: mainFontSize, lineHeight: mainFontSize * 1.4 }]}>
        {mainSection}
      </Text>
      {details.length > 0 && (
        <>
          <View style={richStyles.divider} />
          {details.map((line, i) => (
            <Text key={i} style={richStyles.detailText}>{line}</Text>
          ))}
        </>
      )}
    </ScrollView>
  );
}

/** Routes to the correct renderer. Audio has already been extracted by SwipeCard. */
function CardContent({ text }: { text: string }) {
  if (hasHtml(text)) {
    if (Platform.OS === 'web') return <WebContent html={text} />;
    return <NativeContent html={text} />;
  }
  return <PlainContent text={text} />;
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

    const rawDisplay = flipped ? card.back : card.front;
    // Extract audio so it can be rendered outside the flip Pressable
    const { src: audioSrc, html: displayText } = extractAudio(rawDisplay);

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

            {/* Audio outside Pressable so controls don't trigger card flip */}
            {audioSrc && <AudioPlayer src={audioSrc} />}

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
    paddingHorizontal: 28,
    paddingVertical: 24,
    gap: 0,
  },
  image: {
    width: CARD_WIDTH - 56,
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
  },
  audioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  audioIcon: { fontSize: 18 },
  audioText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  mainText: {
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  divider: {
    width: 40,
    height: 1.5,
    backgroundColor: '#e5e7eb',
    borderRadius: 1,
    marginVertical: 14,
  },
  detailText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 2,
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
