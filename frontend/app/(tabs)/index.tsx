import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  TextInput,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { DeckWithCounts } from '@/src/types';
import { getAllDecksWithCounts, createDeck } from '@/src/db/queries/decks';

export default function DeckListScreen() {
  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const router = useRouter();

  const loadDecks = useCallback(async () => {
    const result = await getAllDecksWithCounts();
    setDecks(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDecks();
    }, [loadDecks])
  );

  const handleCreateDeck = async () => {
    const name = newDeckName.trim();
    if (!name) return;
    await createDeck(name);
    setNewDeckName('');
    setShowCreate(false);
    loadDecks();
  };

  const renderDeck = ({ item }: { item: DeckWithCounts }) => {
    const dueTotal = item.due_count + item.new_count;

    return (
      <Pressable
        style={styles.deckCard}
        onPress={() => router.push(`/deck/${item.id}`)}
      >
        <View style={styles.deckInfo}>
          <Text style={styles.deckName}>{item.name}</Text>
          <Text style={styles.deckMeta}>
            {item.total_cards} card{item.total_cards !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.badgeContainer}>
          {item.new_count > 0 && (
            <View style={[styles.badge, styles.newBadge]}>
              <Text style={styles.newBadgeText}>{item.new_count} new</Text>
            </View>
          )}
          {item.due_count > 0 && (
            <View style={[styles.badge, styles.dueBadge]}>
              <Text style={styles.dueBadgeText}>{item.due_count} due</Text>
            </View>
          )}
          {dueTotal === 0 && (
            <View style={styles.donePill}>
              <Text style={styles.doneText}>Done ✓</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={decks}
        keyExtractor={(item) => item.id}
        renderItem={renderDeck}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>No decks yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a deck below, or tap{' '}
              <Text style={styles.emptyLink} onPress={() => router.push('/import')}>
                Import
              </Text>
              {' '}in the top-right to load an .apkg file.
            </Text>
          </View>
        }
      />

      {showCreate ? (
        <View style={styles.createForm}>
          <TextInput
            style={styles.input}
            placeholder="Deck name…"
            placeholderTextColor="#9ca3af"
            value={newDeckName}
            onChangeText={setNewDeckName}
            autoFocus
            onSubmitEditing={handleCreateDeck}
            returnKeyType="done"
          />
          <View style={styles.createButtons}>
            <Pressable style={styles.cancelBtn} onPress={() => { setShowCreate(false); setNewDeckName(''); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.createBtn, !newDeckName.trim() && styles.createBtnDisabled]}
              onPress={handleCreateDeck}
              disabled={!newDeckName.trim()}
            >
              <Text style={styles.createText}>Create</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.fab} onPress={() => setShowCreate(true)}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  list: { padding: 16, paddingBottom: 100 },

  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e8f0fe',
  },
  deckInfo: { flex: 1, marginRight: 12 },
  deckName: { fontSize: 17, fontWeight: '700', color: '#1e3a5f', marginBottom: 4 },
  deckMeta: { fontSize: 13, color: '#6b7280' },

  badgeContainer: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newBadge: { backgroundColor: '#eff6ff' },
  newBadgeText: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  dueBadge: { backgroundColor: '#f0fdf4' },
  dueBadgeText: { color: '#16a34a', fontSize: 12, fontWeight: '700' },
  donePill: { paddingHorizontal: 10, paddingVertical: 4 },
  doneText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#374151', marginBottom: 10 },
  emptySubtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  emptyLink: { color: '#3b82f6', fontWeight: '600' },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: { fontSize: 30, color: '#fff', fontWeight: '300', marginTop: -2 },

  createForm: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    marginBottom: 12,
    color: '#1f2937',
    backgroundColor: '#fafafa',
  },
  createButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 11 },
  cancelText: { color: '#6b7280', fontSize: 15, fontWeight: '500' },
  createBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
  },
  createBtnDisabled: { backgroundColor: '#93c5fd' },
  createText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
