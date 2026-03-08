import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import { Card, NoteType, State } from '../../types';

const CARD_WITH_CSS = `
  SELECT c.*, COALESCE(nt.css, '') as css
  FROM cards c
  LEFT JOIN note_types nt ON nt.id = c.notetype_id
`;

export async function getDueCards(deckId: string): Promise<Card[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const todayStart = today + 'T00:00:00.000Z';

  // Get deck settings and today's new-card usage
  const stats = await db.getFirstAsync<{
    new_cards_studied: number;
    new_cards_per_day: number;
    max_reviews_per_day: number;
  }>(
    `SELECT COALESCE(ds.new_cards_studied, 0) as new_cards_studied,
            COALESCE(d.new_cards_per_day, 10) as new_cards_per_day,
            COALESCE(d.max_reviews_per_day, 9999) as max_reviews_per_day
     FROM decks d
     LEFT JOIN daily_stats ds ON ds.deck_id = d.id AND ds.date = ?
     WHERE d.id = ?`,
    [today, deckId]
  );

  const newLimit = Math.max(0, (stats?.new_cards_per_day ?? 10) - (stats?.new_cards_studied ?? 0));

  // Count review-state cards already reviewed today (to respect max_reviews_per_day)
  const reviewedToday = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM review_log
     WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)
       AND state = 2
       AND reviewed_at >= ?`,
    [deckId, todayStart]
  );
  const reviewLimit = Math.max(0, (stats?.max_reviews_per_day ?? 9999) - (reviewedToday?.c ?? 0));

  // Learning + Relearning cards (highest priority, sorted by due)
  const learningCards = await db.getAllAsync<Card>(
    `${CARD_WITH_CSS} WHERE c.deck_id = ? AND c.state IN (1, 3) AND c.due <= ? ORDER BY c.due ASC`,
    [deckId, now]
  );

  // Review cards (due today or overdue, capped by daily limit)
  const reviewCards = await db.getAllAsync<Card>(
    `${CARD_WITH_CSS} WHERE c.deck_id = ? AND c.state = 2 AND c.due <= ? ORDER BY c.due ASC LIMIT ?`,
    [deckId, now, reviewLimit]
  );

  // New cards (up to daily limit)
  const newCards = await db.getAllAsync<Card>(
    `${CARD_WITH_CSS} WHERE c.deck_id = ? AND c.state = 0 ORDER BY c.created_at ASC LIMIT ?`,
    [deckId, newLimit]
  );

  return [...learningCards, ...reviewCards, ...newCards];
}

export async function getCardsByDeck(deckId: string, limit = 200): Promise<Card[]> {
  const db = await getDatabase();
  return db.getAllAsync<Card>(
    `${CARD_WITH_CSS} WHERE c.deck_id = ? ORDER BY c.created_at ASC LIMIT ?`,
    [deckId, limit]
  );
}

export async function getCard(id: string): Promise<Card | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Card>(`${CARD_WITH_CSS} WHERE c.id = ?`, [id]);
}

export async function createNoteTypesBatch(noteTypes: NoteType[]): Promise<void> {
  if (noteTypes.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const nt of noteTypes) {
      await db.runAsync(
        'INSERT OR REPLACE INTO note_types (id, name, css) VALUES (?, ?, ?)',
        [nt.id, nt.name, nt.css]
      );
    }
  });
}

export async function createCard(deckId: string, front: string, back: string, tags: string = ''): Promise<Card> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  await db.runAsync(
    `INSERT INTO cards (id, deck_id, notetype_id, front, back, tags, state, due, stability, difficulty,
     elapsed_days, scheduled_days, reps, lapses, last_review, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, 0, ?, 0, 0, 0, 0, 0, 0, NULL, ?, ?)`,
    [id, deckId, front, back, tags, now, now, now]
  );

  return {
    id, deck_id: deckId, front, back, tags,
    state: State.New, due: now, stability: 0, difficulty: 0,
    elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0,
    last_review: null, created_at: now, updated_at: now,
  };
}

export async function createCardsBatch(
  deckId: string,
  cards: { front: string; back: string; tags: string; notetype_id?: string }[]
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const card of cards) {
      const id = uuidv4();
      await db.runAsync(
        `INSERT INTO cards (id, deck_id, notetype_id, front, back, tags, state, due, stability, difficulty,
         elapsed_days, scheduled_days, reps, lapses, last_review, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, 0, 0, 0, 0, 0, NULL, ?, ?)`,
        [id, deckId, card.notetype_id || null, card.front, card.back, card.tags || '', now, now, now]
      );
    }
  });
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
