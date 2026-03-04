import { useCallback, useEffect } from 'react';
import { useReviewStore } from '../stores/reviewStore';
import { getDueCards } from '../db/queries/cards';
import { updateCardScheduling } from '../db/queries/cards';
import { createReviewLog, deleteReviewLog, decrementDailyStats } from '../db/queries/reviewLog';
import { reviewCard } from '../fsrs/scheduler';
import { Card, SwipeDirection, ratingFromSwipe, State } from '../types';
import * as Haptics from 'expo-haptics';

export function useReviewSession(deckId: string) {
  const store = useReviewStore();

  const loadCards = useCallback(async () => {
    store.setLoading(true);
    try {
      const cards = await getDueCards(deckId);
      store.setCards(cards);
    } finally {
      store.setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadCards();
    return () => store.reset();
  }, [deckId]);

  const handleSwipe = useCallback(async (card: Card, direction: SwipeDirection) => {
    const rating = ratingFromSwipe(direction);
    const cardBefore = { ...card };
    const wasNew = card.state === State.New;

    // Apply FSRS scheduling
    const updatedCard = reviewCard(card, rating);

    // Persist to DB
    await updateCardScheduling(updatedCard);
    const log = await createReviewLog(cardBefore, rating);

    // Push undo entry
    store.pushUndo({ cardBefore, reviewLogId: log.id, wasNew });

    // Advance to next card
    store.advanceCard();

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleUndo = useCallback(async () => {
    const entry = store.popUndo();
    if (!entry) return;

    // Restore card state in DB
    await updateCardScheduling(entry.cardBefore);

    // Delete the review log
    await deleteReviewLog(entry.reviewLogId);

    // Decrement daily stats
    const today = new Date().toISOString().slice(0, 10);
    await decrementDailyStats(entry.cardBefore.deck_id, today, entry.wasNew);

    // Restore card in the queue
    store.restoreCard(entry.cardBefore);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const currentCards = store.cards.slice(store.currentIndex);

  return {
    cards: currentCards,
    isLoading: store.isLoading,
    sessionComplete: store.sessionComplete,
    reviewedCount: store.reviewedCount,
    canUndo: store.undoStack.length > 0,
    handleSwipe,
    handleUndo,
    reload: loadCards,
  };
}
