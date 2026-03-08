import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import { Deck, DeckWithCounts } from '../../types';

export async function getAllDecksWithCounts(): Promise<DeckWithCounts[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const rows = await db.getAllAsync<DeckWithCounts & { new_today: number }>(`
    SELECT
      d.*,
      COALESCE(tc.total_cards, 0) as total_cards,
      COALESCE(dc.due_count, 0) as due_count,
      COALESCE(nc.new_count, 0) as new_count,
      COALESCE(ds.new_cards_studied, 0) as new_today
    FROM decks d
    LEFT JOIN (
      SELECT deck_id, COUNT(*) as total_cards FROM cards GROUP BY deck_id
    ) tc ON tc.deck_id = d.id
    LEFT JOIN (
      SELECT deck_id, COUNT(*) as due_count
      FROM cards WHERE due <= ? AND state != 0
      GROUP BY deck_id
    ) dc ON dc.deck_id = d.id
    LEFT JOIN (
      SELECT deck_id, COUNT(*) as new_count
      FROM cards WHERE state = 0
      GROUP BY deck_id
    ) nc ON nc.deck_id = d.id
    LEFT JOIN daily_stats ds ON ds.deck_id = d.id AND ds.date = ?
    ORDER BY d.updated_at DESC
  `, [now, today]);

  return rows.map(row => ({
    ...row,
    new_count: Math.max(0, Math.min(row.new_count, row.new_cards_per_day - row.new_today)),
  }));
}

export async function getDeckWithCounts(id: string): Promise<DeckWithCounts | null> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const rows = await db.getAllAsync<DeckWithCounts & { new_today: number }>(`
    SELECT
      d.*,
      COALESCE(tc.total_cards, 0) as total_cards,
      COALESCE(dc.due_count, 0) as due_count,
      COALESCE(nc.new_count, 0) as new_count,
      COALESCE(ds.new_cards_studied, 0) as new_today
    FROM decks d
    LEFT JOIN (
      SELECT COUNT(*) as total_cards FROM cards WHERE deck_id = ?
    ) tc ON 1=1
    LEFT JOIN (
      SELECT COUNT(*) as due_count FROM cards WHERE deck_id = ? AND due <= ? AND state != 0
    ) dc ON 1=1
    LEFT JOIN (
      SELECT COUNT(*) as new_count FROM cards WHERE deck_id = ? AND state = 0
    ) nc ON 1=1
    LEFT JOIN daily_stats ds ON ds.deck_id = d.id AND ds.date = ?
    WHERE d.id = ?
  `, [id, id, now, id, today, id]);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    new_count: Math.max(0, Math.min(row.new_count, row.new_cards_per_day - row.new_today)),
  };
}

export async function getDeck(id: string): Promise<Deck | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Deck>('SELECT * FROM decks WHERE id = ?', [id]);
}

export async function createDeck(name: string, description: string = '', css: string = ''): Promise<Deck> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  await db.runAsync(
    'INSERT INTO decks (id, name, description, css, new_cards_per_day, max_reviews_per_day, created_at, updated_at) VALUES (?, ?, ?, ?, 10, 9999, ?, ?)',
    [id, name, description, css, now, now]
  );

  return { id, name, description, css, new_cards_per_day: 10, max_reviews_per_day: 9999, created_at: now, updated_at: now };
}

export async function updateDeck(id: string, updates: Partial<Pick<Deck, 'name' | 'description' | 'new_cards_per_day'>>): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: (string | number)[] = [now];

  if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
  if (updates.new_cards_per_day !== undefined) { sets.push('new_cards_per_day = ?'); values.push(updates.new_cards_per_day); }

  values.push(id);
  await db.runAsync(`UPDATE decks SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deleteDeck(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM decks WHERE id = ?', [id]);
}

export async function deleteAllDecks(): Promise<void> {
  const db = await getDatabase();
  // review_log and daily_stats cascade from cards/decks via ON DELETE CASCADE
  await db.runAsync('DELETE FROM review_log');
  await db.runAsync('DELETE FROM daily_stats');
  await db.runAsync('DELETE FROM cards');
  await db.runAsync('DELETE FROM decks');
}
