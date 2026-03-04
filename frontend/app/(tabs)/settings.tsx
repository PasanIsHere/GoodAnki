import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { resetDatabase } from '@/src/db/database';
import { seedDatabase } from '@/src/db/seed';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  const handleImport = () => {
    router.push('/import');
  };

  const handleResetAndSeed = () => {
    Alert.alert(
      'Reset Database',
      'This will delete all data and re-seed with sample cards. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase();
            await seedDatabase();
            Alert.alert('Done', 'Database has been reset with sample data.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <SettingsRow label="Import .apkg file" onPress={handleImport} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Theme</Text>
          <Text style={styles.rowValue}>{colorScheme === 'dark' ? 'Dark' : 'Light'} (system)</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug</Text>
        <SettingsRow label="Reset database & re-seed" onPress={handleResetAndSeed} destructive />
      </View>

      <Text style={styles.version}>GoodAnki v0.1.0</Text>
    </ScrollView>
  );
}

function SettingsRow({ label, onPress, destructive }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={[styles.rowLabel, destructive && styles.destructiveText]}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: { fontSize: 16, color: '#1f2937' },
  rowValue: { fontSize: 14, color: '#6b7280' },
  chevron: { fontSize: 20, color: '#9ca3af' },
  destructiveText: { color: '#ef4444' },
  version: { textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 32 },
});
