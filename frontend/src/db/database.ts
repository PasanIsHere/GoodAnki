import * as SQLite from 'expo-sqlite';

const DB_NAME = 'goodanki.db';

// Store on global to survive hot module replacement during development.
// Without this, HMR re-evaluates this module and loses the reference to the
// open connection, causing a second open attempt → OPFS lock conflict.
const g = global as any;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (g.__goodankiDb) return g.__goodankiDb;
  // Promise lock prevents concurrent callers from opening multiple connections.
  if (!g.__goodankiDbPromise) {
    g.__goodankiDbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync('PRAGMA cache_size = -8000;'); // 8 MB page cache
      await runMigrations(db);
      g.__goodankiDb = db;
      return db;
    })();
  }
  return g.__goodankiDbPromise;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS decks (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      description       TEXT DEFAULT '',
      new_cards_per_day INTEGER DEFAULT 20,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id              TEXT PRIMARY KEY,
      deck_id         TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      front           TEXT NOT NULL,
      back            TEXT NOT NULL,
      tags            TEXT DEFAULT '',
      state           INTEGER DEFAULT 0,
      due             TEXT NOT NULL,
      stability       REAL DEFAULT 0,
      difficulty      REAL DEFAULT 0,
      elapsed_days    INTEGER DEFAULT 0,
      scheduled_days  INTEGER DEFAULT 0,
      reps            INTEGER DEFAULT 0,
      lapses          INTEGER DEFAULT 0,
      last_review     TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_log (
      id              TEXT PRIMARY KEY,
      card_id         TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      rating          INTEGER NOT NULL,
      state           INTEGER NOT NULL,
      reviewed_at     TEXT NOT NULL,
      scheduled_days  INTEGER,
      elapsed_days    INTEGER,
      stability       REAL,
      difficulty      REAL,
      synced          INTEGER DEFAULT 0,
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      deck_id           TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      date              TEXT NOT NULL,
      new_cards_studied INTEGER DEFAULT 0,
      reviews_total     INTEGER DEFAULT 0,
      PRIMARY KEY (deck_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
    CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
    CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state);
    CREATE INDEX IF NOT EXISTS idx_review_log_card_id ON review_log(card_id);
    CREATE INDEX IF NOT EXISTS idx_cards_deck_state_due ON cards(deck_id, state, due);
  `);
}

export async function resetDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DROP TABLE IF EXISTS review_log;
    DROP TABLE IF EXISTS daily_stats;
    DROP TABLE IF EXISTS cards;
    DROP TABLE IF EXISTS decks;
  `);
  await runMigrations(database);
}
