import { FSRS, fsrs, createEmptyCard, Rating, State, type Card as FSRSCard, type Grade } from 'ts-fsrs';
import { Card } from '../types';

const f: FSRS = fsrs();

/** Convert our DB card to ts-fsrs Card object */
function toFSRSCard(card: Card): FSRSCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    learning_steps: 0,
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

/** Apply a rating to a card and return the updated card fields */
export function reviewCard(
  card: Card,
  rating: Rating,
  now: Date = new Date(),
): Card {
  const fsrsCard = toFSRSCard(card);
  const result = f.repeat(fsrsCard, now);
  const scheduled = result[rating as Grade];
  const updatedFSRS = scheduled.card;

  return {
    ...card,
    state: updatedFSRS.state,
    due: updatedFSRS.due.toISOString(),
    stability: updatedFSRS.stability,
    difficulty: updatedFSRS.difficulty,
    elapsed_days: updatedFSRS.elapsed_days,
    scheduled_days: updatedFSRS.scheduled_days,
    reps: updatedFSRS.reps,
    lapses: updatedFSRS.lapses,
    last_review: updatedFSRS.last_review?.toISOString() ?? now.toISOString(),
  };
}

/** Get scheduling info for all ratings (for displaying intervals) */
export function getSchedulingInfo(card: Card, now: Date = new Date()) {
  const fsrsCard = toFSRSCard(card);
  const result = f.repeat(fsrsCard, now);

  const grades = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[];
  const info: Record<number, { due: Date; scheduled_days: number }> = {};
  for (const g of grades) {
    info[g] = {
      due: result[g].card.due,
      scheduled_days: result[g].card.scheduled_days,
    };
  }
  return info;
}

/** Format interval for display */
export function formatInterval(scheduledDays: number, due: Date, now: Date = new Date()): string {
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 1) return '< 1m';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo`;
  const diffYears = (diffDays / 365).toFixed(1);
  return `${diffYears}y`;
}
