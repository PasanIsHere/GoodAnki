import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getStatsOverview, getReviewHistory, type StatsOverview, type DailyReviewData } from '@/src/db/queries/stats';

export default function StatsScreen() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [history, setHistory] = useState<DailyReviewData[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [s, h] = await Promise.all([getStatsOverview(), getReviewHistory(14)]);
        setStats(s);
        setHistory(h);
      })();
    }, [])
  );

  if (!stats) return null;

  const maxReviews = Math.max(1, ...history.map((d) => d.reviews));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today</Text>
        <View style={styles.row}>
          <StatCard label="Reviews" value={stats.todayReviews} color="#22c55e" />
          <StatCard label="New Cards" value={stats.todayNewCards} color="#3b82f6" />
          <StatCard label="Streak" value={stats.streakDays} suffix="d" color="#f59e0b" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Collection</Text>
        <View style={styles.row}>
          <StatCard label="Decks" value={stats.totalDecks} color="#6b7280" />
          <StatCard label="Total Cards" value={stats.totalCards} color="#6b7280" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cards by State</Text>
        <View style={styles.row}>
          <StatCard label="New" value={stats.cardsByState.new} color="#3b82f6" />
          <StatCard label="Learning" value={stats.cardsByState.learning} color="#f59e0b" />
          <StatCard label="Review" value={stats.cardsByState.review} color="#22c55e" />
          <StatCard label="Relearn" value={stats.cardsByState.relearning} color="#ef4444" />
        </View>
      </View>

      {history.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 14 Days</Text>
          <View style={styles.chart}>
            {history.map((day) => (
              <View key={day.date} style={styles.barContainer}>
                <Text style={styles.barValue}>{day.reviews}</Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, (day.reviews / maxReviews) * 100),
                      backgroundColor: '#3b82f6',
                    },
                  ]}
                />
                <Text style={styles.barLabel}>{day.date.slice(5)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, suffix, color }: {
  label: string;
  value: number;
  suffix?: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>
        {value}{suffix || ''}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statValue: { fontSize: 24, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: 12, color: '#6b7280' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, backgroundColor: '#fff', borderRadius: 12, padding: 12, minHeight: 140 },
  barContainer: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '80%', borderRadius: 4, minHeight: 4 },
  barValue: { fontSize: 10, color: '#6b7280' },
  barLabel: { fontSize: 9, color: '#9ca3af' },
});
