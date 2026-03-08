import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useReviewStore } from '../stores/reviewStore';
import { getDueCards } from '../db/queries/cards';
import { updateCardScheduling } from '../db/queries/cards';
import { createReviewLog, deleteReviewLog, decrementDailyStats } from '../db/queries/reviewLog';
import { reviewCard } from '../fsrs/scheduler';
import { Card, SwipeDirection, ratingFromSwipe, State } from '../types';
import * as Haptics from 'expo-haptics';

export function useReviewSession(deckId: string) {
  const store = useReviewStore();
  const totalCountRef = useRef(0);
  const maxProgressRef = useRef(0);

  const loadCards = useCallback(async () => {
    store.setLoading(true);
    maxProgressRef.current = 0;
    try {
      const cards = await getDueCards(deckId);
      totalCountRef.current = cards.length;
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

    // Re-queue if the card is still in a learning step (Again was rated)
    if (updatedCard.state === State.Learning || updatedCard.state === State.Relearning) {
      store.requeueCard(updatedCard);
    }

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

  const { remainingNew, remainingLearn, remainingReview } = useMemo(() => {
    let remainingNew = 0, remainingLearn = 0, remainingReview = 0;
    for (const c of currentCards) {
      if (c.state === State.New) remainingNew++;
      else if (c.state === State.Review) remainingReview++;
      else remainingLearn++;
    }
    return { remainingNew, remainingLearn, remainingReview };
  }, [currentCards]);

  const initialTotal = store.initialNew + store.initialLearn + store.initialReview;
  const remainingTotal = remainingNew + remainingLearn + remainingReview;
  // Never let progress go backwards — re-queued cards can temporarily increase remainingTotal
  const rawProgress = initialTotal > 0 ? 1 - remainingTotal / initialTotal : 0;
  maxProgressRef.current = Math.max(maxProgressRef.current, rawProgress);
  const progress = maxProgressRef.current;

  return {
    cards: currentCards,
    isLoading: store.isLoading,
    sessionComplete: store.sessionComplete,
    reviewedCount: store.reviewedCount,
    totalCount: totalCountRef.current,
    remainingNew,
    remainingLearn,
    remainingReview,
    progress,
    canUndo: store.undoStack.length > 0,
    handleSwipe,
    handleUndo,
    reload: loadCards,
  };
}
