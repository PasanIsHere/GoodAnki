import { create } from 'zustand';
import { Card, Rating, State } from '../types';

export interface UndoEntry {
  cardBefore: Card;
  reviewLogId: string;
  wasNew: boolean;
}

interface ReviewState {
  cards: Card[];
  currentIndex: number;
  undoStack: UndoEntry[];
  isLoading: boolean;
  sessionComplete: boolean;
  reviewedCount: number;

  setCards: (cards: Card[]) => void;
  advanceCard: () => void;
  pushUndo: (entry: UndoEntry) => void;
  popUndo: () => UndoEntry | undefined;
  restoreCard: (card: Card) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  cards: [],
  currentIndex: 0,
  undoStack: [],
  isLoading: false,
  sessionComplete: false,
  reviewedCount: 0,

  setCards: (cards) => set({ cards, currentIndex: 0, sessionComplete: cards.length === 0 }),

  advanceCard: () => {
    const { cards, currentIndex, reviewedCount } = get();
    const nextIndex = currentIndex + 1;
    if (nextIndex >= cards.length) {
      set({ sessionComplete: true, reviewedCount: reviewedCount + 1 });
    } else {
      set({ currentIndex: nextIndex, reviewedCount: reviewedCount + 1 });
    }
  },

  pushUndo: (entry) => set((s) => ({ undoStack: [...s.undoStack, entry] })),

  popUndo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return undefined;
    const entry = undoStack[undoStack.length - 1];
    set((s) => ({
      undoStack: s.undoStack.slice(0, -1),
    }));
    return entry;
  },

  restoreCard: (card) => {
    const { currentIndex, cards, reviewedCount } = get();
    // Insert card back at current position
    const newCards = [...cards];
    const newIndex = Math.max(0, currentIndex - (get().sessionComplete ? 0 : 0));
    newCards.splice(currentIndex, 0, card);
    set({
      cards: newCards,
      sessionComplete: false,
      reviewedCount: Math.max(0, reviewedCount - 1),
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  reset: () => set({
    cards: [],
    currentIndex: 0,
    undoStack: [],
    isLoading: false,
    sessionComplete: false,
    reviewedCount: 0,
  }),
}));
