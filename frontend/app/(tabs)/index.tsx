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
            {item.total_cards} cards
          </Text>
        </View>
        <View style={styles.badgeContainer}>
          {item.new_count > 0 && (
            <View style={[styles.badge, styles.newBadge]}>
              <Text style={styles.badgeText}>{item.new_count}</Text>
            </View>
          )}
          {item.due_count > 0 && (
            <View style={[styles.badge, styles.dueBadge]}>
              <Text style={styles.badgeText}>{item.due_count}</Text>
            </View>
          )}
          {dueTotal === 0 && (
            <Text style={styles.doneText}>Done</Text>
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
            <Text style={styles.emptyTitle}>No decks yet</Text>
            <Text style={styles.emptySubtitle}>Create a deck or import an .apkg file to get started.</Text>
          </View>
        }
      />
      {showCreate ? (
        <View style={styles.createForm}>
          <TextInput
            style={styles.input}
            placeholder="Deck name..."
            value={newDeckName}
            onChangeText={setNewDeckName}
            autoFocus
            onSubmitEditing={handleCreateDeck}
          />
          <View style={styles.createButtons}>
            <Pressable style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.createBtn} onPress={handleCreateDeck}>
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, paddingBottom: 100 },
  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  deckInfo: { flex: 1, marginRight: 12 },
  deckName: { fontSize: 17, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  deckMeta: { fontSize: 13, color: '#6b7280' },
  badgeContainer: { flexDirection: 'row', gap: 6 },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  newBadge: { backgroundColor: '#3b82f6' },
  dueBadge: { backgroundColor: '#22c55e' },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  doneText: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#374151', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', paddingHorizontal: 32 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '400', marginTop: -2 },
  createForm: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  createButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: '#6b7280', fontSize: 15, fontWeight: '500' },
  createBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  createText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
