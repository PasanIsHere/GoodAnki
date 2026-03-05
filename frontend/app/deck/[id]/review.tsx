import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import CardStack, { CardStackHandle } from '@/src/components/review/CardStack';
import UndoButton from '@/src/components/review/UndoButton';
import { useReviewSession } from '@/src/hooks/useReviewSession';

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cardStackRef = useRef<CardStackHandle>(null);

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

        <View style={styles.progressPill}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          <Text style={styles.progressLabel}>
            {reviewedCount} / {totalCount}
          </Text>
        </View>

        <UndoButton onPress={handleUndo} disabled={!canUndo} />
      </View>

      {sessionComplete ? (
        <View style={styles.centered}>
          <View style={styles.completionCard}>
            <Text style={styles.doneEmoji}>🎉</Text>
            <Text style={styles.doneTitle}>Session Complete!</Text>
            <Text style={styles.doneSub}>
              {reviewedCount} card{reviewedCount !== 1 ? 's' : ''} reviewed
            </Text>
            <View style={styles.statRow}>
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
          {/* Card stack */}
          <View style={styles.stackArea}>
            <CardStack ref={cardStackRef} cards={cards} onSwipe={handleSwipe} />
          </View>

          {/* Tinder-style action buttons */}
          <View style={styles.actions}>
            <View style={styles.actionItem}>
              <Pressable
                style={[styles.actionBtn, styles.againBtn]}
                onPress={() => cardStackRef.current?.swipe('left')}
              >
                <Text style={styles.againIcon}>✕</Text>
              </Pressable>
              <Text style={[styles.actionLabel, { color: '#ef4444' }]}>Again</Text>
            </View>

            <View style={styles.actionItem}>
              <Pressable
                style={[styles.actionBtn, styles.easyBtn]}
                onPress={() => cardStackRef.current?.swipe('up')}
              >
                <Text style={styles.easyIcon}>★</Text>
              </Pressable>
              <Text style={[styles.actionLabel, { color: '#3b82f6' }]}>Easy</Text>
            </View>

            <View style={styles.actionItem}>
              <Pressable
                style={[styles.actionBtn, styles.goodBtn]}
                onPress={() => cardStackRef.current?.swipe('right')}
              >
                <Text style={styles.goodIcon}>♥</Text>
              </Pressable>
              <Text style={[styles.actionLabel, { color: '#22c55e' }]}>Good</Text>
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

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 13, color: '#6b7280', fontWeight: '700' },

  // Progress pill replaces the separate bar
  progressPill: {
    flex: 1,
    height: 28,
    backgroundColor: '#e5e7eb',
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    opacity: 0.25,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.3,
  },

  // Card stack area
  stackArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tinder action buttons
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 28,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 12,
  },
  actionItem: {
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    borderWidth: 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  againBtn: {
    width: 58,
    height: 58,
    borderColor: '#fca5a5',
  },
  easyBtn: {
    width: 50,
    height: 50,
    borderColor: '#93c5fd',
  },
  goodBtn: {
    width: 66,
    height: 66,
    borderColor: '#86efac',
  },
  againIcon: { fontSize: 22, color: '#ef4444', fontWeight: '700' },
  easyIcon: { fontSize: 20, color: '#3b82f6', fontWeight: '700' },
  goodIcon: { fontSize: 26, color: '#22c55e' },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

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
  doneSub: { fontSize: 16, color: '#6b7280', marginBottom: 24 },
  statRow: {
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
