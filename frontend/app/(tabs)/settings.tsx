import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { resetDatabase } from '@/src/db/database';
import { seedDatabase } from '@/src/db/seed';
import { deleteAllDecks } from '@/src/db/queries/decks';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  const handleImport = () => {
    router.push('/import');
  };

  const handleDeleteAllDecks = () => {
    const run = () => {
      deleteAllDecks()
        .then(() => Alert.alert('Done', 'All decks and cards have been deleted.'))
        .catch(e => Alert.alert('Error', String(e)));
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete all decks and cards? This cannot be undone.')) run();
    } else {
      Alert.alert(
        'Delete All Decks',
        'This will permanently delete all decks and cards. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete All', style: 'destructive', onPress: run },
        ]
      );
    }
  };

  const handleResetAndSeed = () => {
    const run = () => {
      resetDatabase()
        .then(() => seedDatabase())
        .then(() => Alert.alert('Done', 'Database has been reset with sample data.'))
        .catch(e => Alert.alert('Error', String(e)));
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Reset database and re-seed with sample cards? All data will be lost.')) run();
    } else {
      Alert.alert(
        'Reset Database',
        'This will delete all data and re-seed with sample cards. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: run },
        ]
      );
    }
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
        <SettingsRow label="Delete all decks" onPress={handleDeleteAllDecks} destructive />
        <SettingsRow label="Reset database & re-seed" onPress={handleResetAndSeed} destructive />
      </View>

      <Text style={styles.version}>GoodAnki v0.1.0</Text>
    </ScrollView>
  );
}

function SettingsRow({ label, onPress, destructive }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      android_ripple={{ color: '#f3f4f6' }}
    >
      <Text style={[styles.rowLabel, destructive && styles.destructiveText]}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  content: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  rowLabel: { fontSize: 15, color: '#1f2937', fontWeight: '500' },
  rowValue: { fontSize: 14, color: '#9ca3af' },
  chevron: { fontSize: 18, color: '#d1d5db' },
  destructiveText: { color: '#ef4444' },
  version: { textAlign: 'center', fontSize: 12, color: '#d1d5db', marginTop: 40 },
});
