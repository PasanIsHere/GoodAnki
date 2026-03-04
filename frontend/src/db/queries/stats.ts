import { getDatabase } from '../database';

export interface StatsOverview {
  totalDecks: number;
  totalCards: number;
  cardsByState: { new: number; learning: number; review: number; relearning: number };
  todayReviews: number;
  todayNewCards: number;
  streakDays: number;
}

export async function getStatsOverview(): Promise<StatsOverview> {
  const db = await getDatabase();
  const today = new Date().toISOString().slice(0, 10);

  const totalDecks = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM decks');
  const totalCards = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM cards');

  const byState = await db.getAllAsync<{ state: number; c: number }>(
    'SELECT state, COUNT(*) as c FROM cards GROUP BY state'
  );
  const stateMap: Record<number, number> = {};
  for (const row of byState) stateMap[row.state] = row.c;

  const todayStats = await db.getFirstAsync<{ reviews: number; new_studied: number }>(
    `SELECT COALESCE(SUM(reviews_total), 0) as reviews,
            COALESCE(SUM(new_cards_studied), 0) as new_studied
     FROM daily_stats WHERE date = ?`,
    [today]
  );

  // Calculate streak: consecutive days with at least 1 review
  const recentDays = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT date FROM daily_stats WHERE reviews_total > 0 ORDER BY date DESC LIMIT 365`
  );

  let streak = 0;
  const checkDate = new Date();
  for (const row of recentDays) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (row.date === dateStr) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    totalDecks: totalDecks?.c ?? 0,
    totalCards: totalCards?.c ?? 0,
    cardsByState: {
      new: stateMap[0] ?? 0,
      learning: stateMap[1] ?? 0,
      review: stateMap[2] ?? 0,
      relearning: stateMap[3] ?? 0,
    },
    todayReviews: todayStats?.reviews ?? 0,
    todayNewCards: todayStats?.new_studied ?? 0,
    streakDays: streak,
  };
}

export interface DailyReviewData {
  date: string;
  reviews: number;
  newCards: number;
}

export async function getReviewHistory(days: number = 30): Promise<DailyReviewData[]> {
  const db = await getDatabase();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().slice(0, 10);

  return db.getAllAsync<DailyReviewData>(
    `SELECT date, SUM(reviews_total) as reviews, SUM(new_cards_studied) as newCards
     FROM daily_stats WHERE date >= ?
     GROUP BY date ORDER BY date ASC`,
    [startStr]
  );
}
