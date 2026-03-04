import { State, Rating } from 'ts-fsrs';

export { State, Rating };

export interface Deck {
  id: string;
  name: string;
  description: string;
  new_cards_per_day: number;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  tags: string;
  state: State;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewLog {
  id: string;
  card_id: string;
  rating: Rating;
  state: State;
  reviewed_at: string;
  scheduled_days: number;
  elapsed_days: number;
  stability: number;
  difficulty: number;
  synced: number;
  created_at: string;
}

export interface DailyStats {
  deck_id: string;
  date: string;
  new_cards_studied: number;
  reviews_total: number;
}

export interface DeckWithCounts extends Deck {
  total_cards: number;
  due_count: number;
  new_count: number;
}

export type SwipeDirection = 'left' | 'right' | 'up';

export function ratingFromSwipe(direction: SwipeDirection): Rating {
  switch (direction) {
    case 'left': return Rating.Again;
    case 'right': return Rating.Good;
    case 'up': return Rating.Easy;
  }
}
