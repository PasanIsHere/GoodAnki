import React, { useCallback, useImperativeHandle, useState } from 'react';
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

/** Extract the first <audio> src from html, returning cleaned html and src. */
function extractAudio(html: string): { src: string | null; html: string } {
  let src: string | null = null;
  const cleaned = html.replace(/<audio[^>]+src="([^"]+)"[^>]*>(?:<\/audio>)?/gi, (_, s) => {
    if (!src) src = s;
    return '';
  });
  return { src, html: cleaned };
}

// ── Web: iframe renderer ───────────────────────────────────────────────────────

/**
 * On web, renders ALL content (images + audio) inside an <iframe srcdoc>.
 * Benefits:
 *  - data: URIs for images and audio work natively in an iframe
 *  - Audio controls are native browser UI — not intercepted by RNGF gesture handler
 *  - No percentage-height CSS quirks (iframe fills parent via flex)
 * Tap-to-flip is wired via window.postMessage from inside the iframe.
 */
function extractStyles(html: string): { styles: string; content: string } {
  const styles: string[] = [];
  const content = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    styles.push(css);
    return '';
  });
  return { styles: styles.join('\n'), content: content.trim() };
}

function buildIframeDoc(html: string, deckCss?: string): string {
  const { styles, content } = extractStyles(html);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:100%;min-height:100vh;-webkit-text-size-adjust:100%}
  body{display:flex;flex-direction:column;justify-content:center;align-items:stretch;cursor:pointer}
  .card{flex:1;padding:20px 24px;text-align:center;word-break:break-word;font-size:17px;line-height:1.6;color:#111827;font-family:system-ui,sans-serif;background:#fff}
  img{max-width:100%;height:auto;display:block;margin:6px auto}
  audio{width:100%;margin:6px 0;border-radius:8px;cursor:auto}
  .cloze-blank{display:inline-block;background:#dbeafe;color:#1d4ed8;padding:1px 8px;border-radius:5px;font-weight:700;letter-spacing:0.5px}
  .cloze-answer{display:inline-block;background:#dcfce7;color:#15803d;padding:1px 8px;border-radius:5px;font-weight:700;border-bottom:2px solid #16a34a}
</style>
${deckCss ? `<style>${deckCss}</style>` : ''}
${styles ? `<style>${styles}</style>` : ''}
</head>
<body>
<div class="card">${content}</div>
<script>
document.body.addEventListener('click',function(e){
  var t=e.target;
  while(t){
    var tag=t.tagName&&t.tagName.toUpperCase();
    if(tag==='AUDIO'||tag==='VIDEO'||tag==='BUTTON'||tag==='A'||tag==='INPUT'||t.controls){return;}
    t=t.parentElement;
  }
  window.parent.postMessage('__gk_flip__','*');
});
</script>
</body>
</html>`;
}

function IframeContent({ html, onFlip, deckCss, prebuilt }: { html: string; onFlip: () => void; deckCss?: string; prebuilt?: boolean }) {
  // Listen for flip messages from the iframe
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: MessageEvent) => {
      if (e.data === '__gk_flip__') onFlip();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onFlip]);

  const doc = prebuilt ? html : buildIframeDoc(html, deckCss);

  return (
    // @ts-ignore — iframe is a valid HTML element on web
    <iframe
      srcDoc={doc}
      style={{ flex: 1, border: 'none', width: '100%', display: 'block' }}
    />
  );
}

// ── Native: image + text renderer ─────────────────────────────────────────────

function NativeInner({ html }: { html: string }) {
  const images = extractImages(html);
  const rawText = htmlToText(html);
  const sections = rawText.split('\n').map(s => s.trim()).filter(Boolean);
  const mainSection = sections[0] ?? '';
  const details = sections.slice(1);
  const mainFontSize = cardFontSize(mainSection.length);

  return (
    <>
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
    </>
  );
}

function NativeContent({ html }: { html: string }) {
  return (
    <ScrollView contentContainerStyle={richStyles.scroll} showsVerticalScrollIndicator={false}>
      <NativeInner html={html} />
    </ScrollView>
  );
}

// ── Plain text renderer ────────────────────────────────────────────────────────

function PlainInner({ text }: { text: string }) {
  const sections = text.split('\n').map(s => s.trim()).filter(Boolean);
  if (sections.length === 0) return null;
  const mainSection = sections[0];
  const details = sections.slice(1);
  const mainFontSize = cardFontSize(mainSection.length);

  return (
    <>
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
    </>
  );
}

function PlainContent({ text }: { text: string }) {
  return (
    <ScrollView contentContainerStyle={richStyles.scroll} showsVerticalScrollIndicator={false}>
      <PlainInner text={text} />
    </ScrollView>
  );
}

// ── Combined content (flipped — shows front above answer divider) ──────────────

function CombinedNativeContent({ front, back }: { front: string; back: string }) {
  const { html: frontHtml } = extractAudio(front);
  const { html: backHtml } = extractAudio(back);
  const frontIsHtml = hasHtml(front);
  const backIsHtml = hasHtml(back);

  return (
    <ScrollView contentContainerStyle={richStyles.combinedScroll} showsVerticalScrollIndicator={false}>
      <View style={richStyles.frontSection}>
        {frontIsHtml ? <NativeInner html={frontHtml} /> : <PlainInner text={front} />}
      </View>
      <View style={richStyles.answerSeparator}>
        <View style={richStyles.answerSeparatorLine} />
        <Text style={richStyles.answerSeparatorLabel}>Answer</Text>
        <View style={richStyles.answerSeparatorLine} />
      </View>
      <View style={richStyles.backSection}>
        {backIsHtml ? <NativeInner html={backHtml} /> : <PlainInner text={back} />}
      </View>
    </ScrollView>
  );
}

function buildCombinedIframeDoc(frontHtml: string, backHtml: string, deckCss?: string): string {
  const { styles: frontStyles, content: frontContent } = extractStyles(frontHtml);
  const { styles: backStyles, content: backContent } = extractStyles(backHtml);
  const allStyles = [frontStyles, backStyles].filter(Boolean).join('\n');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:100%;min-height:100vh;-webkit-text-size-adjust:100%}
  body{display:flex;flex-direction:column;align-items:stretch;cursor:pointer}
  .card{text-align:center;word-break:break-word;font-size:17px;line-height:1.6;color:#111827;font-family:system-ui,sans-serif;background:#fff}
  img{max-width:100%;height:auto;display:block;margin:6px auto}
  audio{width:100%;margin:6px 0;border-radius:8px;cursor:auto}
  .cloze-blank{display:inline-block;background:#dbeafe;color:#1d4ed8;padding:1px 8px;border-radius:5px;font-weight:700;letter-spacing:0.5px}
  .cloze-answer{display:inline-block;background:#dcfce7;color:#15803d;padding:1px 8px;border-radius:5px;font-weight:700;border-bottom:2px solid #16a34a}
  .front-wrapper{opacity:0.55;font-size:0.88em;padding:16px 24px 10px}
  .sep{display:flex;align-items:center;gap:10px;padding:0 24px;margin:6px 0;color:#9ca3af;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
  .sep::before,.sep::after{content:'';flex:1;height:1px;background:#e5e7eb}
  .back-wrapper{padding:10px 24px 20px}
</style>
${deckCss ? `<style>${deckCss}</style>` : ''}
${allStyles ? `<style>${allStyles}</style>` : ''}
</head>
<body>
<div class="front-wrapper card">${frontContent}</div>
<div class="sep">Answer</div>
<div class="back-wrapper card">${backContent}</div>
<script>
document.body.addEventListener('click',function(e){
  var t=e.target;
  while(t){
    var tag=t.tagName&&t.tagName.toUpperCase();
    if(tag==='AUDIO'||tag==='VIDEO'||tag==='BUTTON'||tag==='A'||tag==='INPUT'||t.controls){return;}
    t=t.parentElement;
  }
  window.parent.postMessage('__gk_flip__','*');
});
</script>
</body>
</html>`;
}

// ── Audio chip (native only — informational, no playback without expo-av) ─────

function AudioChip() {
  return (
    <View style={richStyles.audioChip}>
      <Text style={richStyles.audioIcon}>🔊</Text>
      <Text style={richStyles.audioText}>Audio clip</Text>
    </View>
  );
}

// ── SwipeCard ─────────────────────────────────────────────────────────────────

const SwipeCard = React.forwardRef<SwipeCardHandle, SwipeCardProps>(
  function SwipeCard({ card, onSwipe, isTop, index }, ref) {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const [flipped, setFlipped] = useState(false);

    const handleFlip = useCallback(() => {
      if (isTop) setFlipped(f => !f);
    }, [isTop]);

    useImperativeHandle(ref, () => ({
      swipe(direction: SwipeDirection) {
        if (!flipped) return;
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
        setTimeout(() => onSwipe(direction), 260);
      },
    }));

    const panGesture = Gesture.Pan()
      .enabled(isTop && flipped)
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
      const scale = interpolate(progress, [0, 1], [1 - index * 0.045, 1 - (index - 1) * 0.045]);
      const yOffset = interpolate(progress, [0, 1], [index * 10, (index - 1) * 10]);
      return { transform: [{ scale }, { translateY: yOffset }] };
    });

    const isWeb = Platform.OS === 'web';
    const frontIsHtml = hasHtml(card.front);

    // On native: extract audio from the front for the chip
    const { src: audioSrc, html: frontNativeHtml } = !isWeb
      ? extractAudio(card.front)
      : { src: null, html: '' };

    return (
      <Animated.View style={[styles.wrap, { zIndex: 10 - index }, cardAnimStyle]}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.card}>
            <SwipeOverlay translateX={translateX} translateY={translateY} />

            {/* Header — always tappable to flip */}
            <Pressable
              onPress={handleFlip}
              style={[styles.header, flipped && styles.headerAnswer]}
            >
              <View style={[styles.headerDot, flipped && styles.headerDotAnswer]} />
              <Text style={[styles.headerLabel, flipped && styles.headerLabelAnswer]}>
                {flipped ? 'ANSWER' : 'QUESTION'}
              </Text>
              <View style={styles.headerSpacer} />
              <Text style={[styles.headerFlipHint, flipped && styles.headerFlipHintAnswer]}>
                tap to flip
              </Text>
            </Pressable>

            {/* Native audio chip — only shown on front */}
            {!isWeb && !flipped && audioSrc && <AudioChip />}

            {/* Content area */}
            {isWeb ? (
              <View style={styles.contentArea}>
                {flipped ? (
                  <IframeContent
                    html={buildCombinedIframeDoc(card.front, card.back, card.css)}
                    onFlip={handleFlip}
                    prebuilt
                  />
                ) : (
                  <IframeContent html={card.front} onFlip={handleFlip} deckCss={card.css} />
                )}
              </View>
            ) : flipped ? (
              <Pressable onPress={handleFlip} style={styles.contentArea}>
                <CombinedNativeContent front={card.front} back={card.back} />
              </Pressable>
            ) : (
              <Pressable onPress={handleFlip} style={styles.contentArea}>
                {frontIsHtml ? (
                  <NativeContent html={frontNativeHtml} />
                ) : (
                  <PlainContent text={card.front} />
                )}
              </Pressable>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerHint}>
                {flipped ? 'swipe to rate' : 'tap header or content to flip'}
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
  },
  image: {
    width: CARD_WIDTH - 56,
    height: 200,
    borderRadius: 12,
    marginBottom: 14,
  },
  audioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#bfdbfe',
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
  combinedScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  frontSection: {
    width: '100%',
    alignItems: 'center',
    opacity: 0.55,
    paddingBottom: 4,
  },
  answerSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
    marginVertical: 14,
  },
  answerSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  answerSeparatorLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  backSection: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
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
    paddingVertical: 13,
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
  headerSpacer: { flex: 1 },
  headerFlipHint: {
    fontSize: 10,
    color: '#cbd5e1',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  headerFlipHintAnswer: {
    color: '#bbf7d0',
  },
  contentArea: {
    flex: 1,
  },
  footer: {
    paddingVertical: 11,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerHint: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
