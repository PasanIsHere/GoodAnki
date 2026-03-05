import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
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

  if (!stats) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const maxReviews = Math.max(1, ...history.map((d) => d.reviews));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Today">
        <View style={styles.row}>
          <StatCard label="Reviewed" value={stats.todayReviews} color="#22c55e" />
          <StatCard label="New Cards" value={stats.todayNewCards} color="#3b82f6" />
          <StatCard label="Streak" value={stats.streakDays} suffix="d" color="#f59e0b" />
        </View>
      </Section>

      <Section title="Collection">
        <View style={styles.row}>
          <StatCard label="Decks" value={stats.totalDecks} color="#6b7280" />
          <StatCard label="Cards" value={stats.totalCards} color="#6b7280" />
        </View>
      </Section>

      <Section title="Card States">
        <View style={styles.row}>
          <StatCard label="New" value={stats.cardsByState.new} color="#3b82f6" />
          <StatCard label="Learning" value={stats.cardsByState.learning} color="#f59e0b" />
          <StatCard label="Review" value={stats.cardsByState.review} color="#22c55e" />
          <StatCard label="Relearn" value={stats.cardsByState.relearning} color="#ef4444" />
        </View>
      </Section>

      {history.length > 0 && (
        <Section title="Last 14 Days">
          <View style={styles.chart}>
            {history.map((day) => {
              const barH = Math.max(4, (day.reviews / maxReviews) * 100);
              return (
                <View key={day.date} style={styles.barContainer}>
                  {day.reviews > 0 && (
                    <Text style={styles.barValue}>{day.reviews}</Text>
                  )}
                  <View
                    style={[styles.bar, { height: barH, backgroundColor: day.reviews > 0 ? '#3b82f6' : '#e5e7eb' }]}
                  />
                  <Text style={styles.barLabel}>{day.date.slice(5)}</Text>
                </View>
              );
            })}
          </View>
        </Section>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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
        {value.toLocaleString()}{suffix ?? ''}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  content: { padding: 16, paddingBottom: 32 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4ff' },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  row: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontSize: 22, fontWeight: '800', marginBottom: 3 },
  statLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },

  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    paddingTop: 24,
    minHeight: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  barContainer: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '75%', borderRadius: 3, minHeight: 4 },
  barValue: { fontSize: 9, color: '#6b7280', fontWeight: '600' },
  barLabel: { fontSize: 8, color: '#d1d5db' },
});
