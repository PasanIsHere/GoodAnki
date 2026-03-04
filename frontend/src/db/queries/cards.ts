import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import { Card, State } from '../../types';

export async function getDueCards(deckId: string, limit: number = 100): Promise<Card[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Get daily stats to know how many new cards we've already studied
  const stats = await db.getFirstAsync<{ new_cards_studied: number; new_cards_per_day: number }>(
    `SELECT COALESCE(ds.new_cards_studied, 0) as new_cards_studied, d.new_cards_per_day
     FROM decks d
     LEFT JOIN daily_stats ds ON ds.deck_id = d.id AND ds.date = ?
     WHERE d.id = ?`,
    [today, deckId]
  );

  const newLimit = Math.max(0, (stats?.new_cards_per_day ?? 20) - (stats?.new_cards_studied ?? 0));

  // Learning + Relearning cards (highest priority, sorted by due)
  const learningCards = await db.getAllAsync<Card>(
    `SELECT * FROM cards
     WHERE deck_id = ? AND state IN (1, 3) AND due <= ?
     ORDER BY due ASC`,
    [deckId, now]
  );

  // Review cards (due today or overdue)
  const reviewCards = await db.getAllAsync<Card>(
    `SELECT * FROM cards
     WHERE deck_id = ? AND state = 2 AND due <= ?
     ORDER BY due ASC`,
    [deckId, now]
  );

  // New cards (up to daily limit)
  const newCards = await db.getAllAsync<Card>(
    `SELECT * FROM cards
     WHERE deck_id = ? AND state = 0
     ORDER BY created_at ASC
     LIMIT ?`,
    [deckId, newLimit]
  );

  const combined = [...learningCards, ...reviewCards, ...newCards];
  return combined.slice(0, limit);
}

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  const db = await getDatabase();
  return db.getAllAsync<Card>(
    'SELECT * FROM cards WHERE deck_id = ? ORDER BY created_at ASC',
    [deckId]
  );
}

export async function getCard(id: string): Promise<Card | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Card>('SELECT * FROM cards WHERE id = ?', [id]);
}

export async function createCard(deckId: string, front: string, back: string, tags: string = ''): Promise<Card> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  await db.runAsync(
    `INSERT INTO cards (id, deck_id, front, back, tags, state, due, stability, difficulty,
     elapsed_days, scheduled_days, reps, lapses, last_review, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, 0, 0, 0, 0, NULL, ?, ?)`,
    [id, deckId, front, back, tags, now, now, now]
  );

  return {
    id, deck_id: deckId, front, back, tags,
    state: State.New, due: now, stability: 0, difficulty: 0,
    elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0,
    last_review: null, created_at: now, updated_at: now,
  };
}

export async function updateCard(id: string, updates: Partial<Pick<Card, 'front' | 'back' | 'tags'>>): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: (string | number)[] = [now];

  if (updates.front !== undefined) { sets.push('front = ?'); values.push(updates.front); }
  if (updates.back !== undefined) { sets.push('back = ?'); values.push(updates.back); }
  if (updates.tags !== undefined) { sets.push('tags = ?'); values.push(updates.tags); }

  values.push(id);
  await db.runAsync(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function updateCardScheduling(card: Card): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE cards SET state = ?, due = ?, stability = ?, difficulty = ?,
     elapsed_days = ?, scheduled_days = ?, reps = ?, lapses = ?,
     last_review = ?, updated_at = ?
     WHERE id = ?`,
    [card.state, card.due, card.stability, card.difficulty,
     card.elapsed_days, card.scheduled_days, card.reps, card.lapses,
     card.last_review, now, card.id]
  );
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM cards WHERE id = ?', [id]);
}
