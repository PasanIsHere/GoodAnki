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
    canUndo,
    handleSwipe,
    handleUndo,
  } = useReviewSession(id!);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
        <Text style={styles.counter}>{reviewedCount} reviewed</Text>
        <UndoButton onPress={handleUndo} disabled={!canUndo} />
      </View>

      {sessionComplete ? (
        <View style={styles.centered}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={styles.doneTitle}>Session Complete!</Text>
          <Text style={styles.doneSubtitle}>
            You reviewed {reviewedCount} card{reviewedCount !== 1 ? 's' : ''}.
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Back to Deck</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <CardStack cards={cards} onSwipe={handleSwipe} />
          <View style={styles.bottomHints}>
            <Text style={styles.hint}>← Again</Text>
            <Text style={styles.hint}>↑ Easy</Text>
            <Text style={styles.hint}>Good →</Text>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  closeBtnText: { fontSize: 16, color: '#3b82f6', fontWeight: '500' },
  counter: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
  bottomHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 16,
    paddingTop: 8,
  },
  hint: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  doneEmoji: { fontSize: 64, marginBottom: 16 },
  doneTitle: { fontSize: 28, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  doneSubtitle: { fontSize: 16, color: '#6b7280', marginBottom: 24 },
  doneBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
