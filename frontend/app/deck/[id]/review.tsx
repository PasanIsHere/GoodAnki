import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import CardStack from '@/src/components/review/CardStack';
import UndoButton from '@/src/components/review/UndoButton';
import { useReviewSession } from '@/src/hooks/useReviewSession';

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    cards,
    isLoading,
    sessionComplete,
    reviewedCount,
    totalCount,
    canUndo,
    handleSwipe,
    handleUndo,
  } = useReviewSession(id!);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading cards…</Text>
      </SafeAreaView>
    );
  }

  const progress = totalCount > 0 ? reviewedCount / totalCount : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        <View style={styles.counterArea}>
          <Text style={styles.counter}>
            {reviewedCount} / {totalCount}
          </Text>
        </View>

        <UndoButton onPress={handleUndo} disabled={!canUndo} />
      </View>

      {/* Progress bar */}
      {!sessionComplete && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {sessionComplete ? (
        <View style={styles.centered}>
          <View style={styles.completionCard}>
            <Text style={styles.doneEmoji}>🎉</Text>
            <Text style={styles.doneTitle}>Session Complete!</Text>
            <Text style={styles.doneSubtitle}>
              {reviewedCount} card{reviewedCount !== 1 ? 's' : ''} reviewed
            </Text>
            <View style={styles.completionStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{reviewedCount}</Text>
                <Text style={styles.statLabel}>Reviewed</Text>
              </View>
            </View>
            <Pressable style={styles.doneBtn} onPress={() => router.back()}>
              <Text style={styles.doneBtnText}>Back to Deck</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <CardStack cards={cards} onSwipe={handleSwipe} />
          <View style={styles.bottomHints}>
            <View style={styles.hintItem}>
              <Text style={styles.hintArrow}>←</Text>
              <Text style={[styles.hintLabel, { color: '#ef4444' }]}>Again</Text>
            </View>
            <View style={styles.hintItem}>
              <Text style={styles.hintArrow}>↑</Text>
              <Text style={[styles.hintLabel, { color: '#3b82f6' }]}>Easy</Text>
            </View>
            <View style={styles.hintItem}>
              <Text style={styles.hintArrow}>→</Text>
              <Text style={[styles.hintLabel, { color: '#22c55e' }]}>Good</Text>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6b7280' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  counterArea: { alignItems: 'center' },
  counter: { fontSize: 15, color: '#374151', fontWeight: '600' },

  progressTrack: {
    height: 4,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },

  bottomHints: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 12,
  },
  hintItem: { alignItems: 'center', gap: 2 },
  hintArrow: { fontSize: 18, color: '#9ca3af' },
  hintLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },

  // Session complete
  completionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  doneEmoji: { fontSize: 56, marginBottom: 12 },
  doneTitle: { fontSize: 26, fontWeight: '800', color: '#1f2937', marginBottom: 6 },
  doneSubtitle: { fontSize: 16, color: '#6b7280', marginBottom: 24 },
  completionStats: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 28,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    width: '100%',
    justifyContent: 'center',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '800', color: '#3b82f6' },
  statLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '500', marginTop: 2 },
  doneBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
