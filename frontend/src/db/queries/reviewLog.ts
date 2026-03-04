import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import { Card, Rating, ReviewLog, State } from '../../types';

export async function createReviewLog(
  card: Card,
  rating: Rating,
): Promise<ReviewLog> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  const log: ReviewLog = {
    id,
    card_id: card.id,
    rating,
    state: card.state,
    reviewed_at: now,
    scheduled_days: card.scheduled_days,
    elapsed_days: card.elapsed_days,
    stability: card.stability,
    difficulty: card.difficulty,
    synced: 0,
    created_at: now,
  };

  await db.runAsync(
    `INSERT INTO review_log (id, card_id, rating, state, reviewed_at,
     scheduled_days, elapsed_days, stability, difficulty, synced, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, card.id, rating, card.state, now,
     card.scheduled_days, card.elapsed_days, card.stability, card.difficulty, now]
  );

  // Update daily stats
  const today = now.slice(0, 10);
  const isNew = card.state === State.New;

  await db.runAsync(
    `INSERT INTO daily_stats (deck_id, date, new_cards_studied, reviews_total)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(deck_id, date) DO UPDATE SET
       new_cards_studied = new_cards_studied + ?,
       reviews_total = reviews_total + 1`,
    [card.deck_id, today, isNew ? 1 : 0, isNew ? 1 : 0]
  );

  return log;
}

export async function deleteReviewLog(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM review_log WHERE id = ?', [id]);
}

export async function getReviewLogsForCard(cardId: string): Promise<ReviewLog[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReviewLog>(
    'SELECT * FROM review_log WHERE card_id = ? ORDER BY reviewed_at DESC',
    [cardId]
  );
}

export async function getDailyStats(deckId: string, date: string) {
  const db = await getDatabase();
  return db.getFirstAsync<{ new_cards_studied: number; reviews_total: number }>(
    'SELECT new_cards_studied, reviews_total FROM daily_stats WHERE deck_id = ? AND date = ?',
    [deckId, date]
  );
}

export async function decrementDailyStats(deckId: string, date: string, wasNew: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE daily_stats SET
       new_cards_studied = MAX(0, new_cards_studied - ?),
       reviews_total = MAX(0, reviews_total - 1)
     WHERE deck_id = ? AND date = ?`,
    [wasNew ? 1 : 0, deckId, date]
  );
}
