import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { DeckWithCounts } from '@/src/types';
import { getAllDecksWithCounts, createDeck } from '@/src/db/queries/decks';

// ── Deck card — extracted + memoized so FlatList doesn't re-render unchanged items ──

const DeckCard = React.memo(function DeckCard({ item }: { item: DeckWithCounts }) {
  const router = useRouter();
  const dueTotal = item.due_count + item.new_count;
  const isDone = dueTotal === 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.deckCard, pressed && styles.deckCardPressed]}
      onPress={() => router.push(`/deck/${item.id}`)}
      android_ripple={{ color: '#dbeafe' }}
    >
      <View style={[styles.accent, isDone && styles.accentDone]} />
      <View style={styles.deckBody}>
        <Text style={styles.deckName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.deckMeta}>
          {item.total_cards.toLocaleString()} card{item.total_cards !== 1 ? 's' : ''}
          {isDone ? ' · All caught up' : ` · ${dueTotal} to study`}
        </Text>
      </View>
      {isDone ? (
        <View style={styles.donePill}>
          <Text style={styles.doneText}>✓</Text>
        </View>
      ) : (
        <View style={styles.duePill}>
          <Text style={styles.duePillCount}>{dueTotal}</Text>
          <Text style={styles.duePillLabel}>due</Text>
        </View>
      )}
    </Pressable>
  );
});

// ── Screen ───────────────────────────────────────────────────────────────────

export default function DeckListScreen() {
  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const loadDecks = useCallback(async () => {
    const result = await getAllDecksWithCounts();
    setDecks(result);
    setIsLoading(false);
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

  const handleShowCreate = () => {
    setShowCreate(true);
    // Focus is handled by autoFocus on TextInput
  };

  const renderDeck = useCallback(
    ({ item }: { item: DeckWithCounts }) => <DeckCard item={item} />,
    []
  );

  const keyExtractor = useCallback((item: DeckWithCounts) => item.id, []);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#3b82f6" />
      ) : (
        <FlatList
          data={decks}
          keyExtractor={keyExtractor}
          renderItem={renderDeck}
          contentContainerStyle={styles.list}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>No decks yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap{' '}
                <Text style={styles.emptyLink} onPress={() => router.push('/import')}>
                  Import
                </Text>
                {' '}in the top-right to load an Anki deck, or create one below.
              </Text>
            </View>
          }
        />
      )}

      {showCreate ? (
        <View style={styles.createSheet}>
          <Text style={styles.createTitle}>New Deck</Text>
          <TextInput
            ref={inputRef}
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
            <Pressable
              style={styles.cancelBtn}
              onPress={() => { setShowCreate(false); setNewDeckName(''); }}
            >
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
        <Pressable style={styles.fab} onPress={handleShowCreate}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  loader: { flex: 1 },
  list: { padding: 16, paddingBottom: 110, gap: 10 },

  // Deck card
  deckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  deckCardPressed: {
    opacity: 0.93,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: '#3b82f6',
  },
  accentDone: {
    backgroundColor: '#22c55e',
  },
  deckBody: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 8,
  },
  deckName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  deckMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  duePill: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  duePillCount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3b82f6',
    lineHeight: 24,
  },
  duePillLabel: {
    fontSize: 11,
    color: '#93c5fd',
    fontWeight: '600',
  },
  donePill: {
    paddingHorizontal: 16,
  },
  doneText: {
    fontSize: 18,
    color: '#22c55e',
    fontWeight: '700',
  },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#374151', marginBottom: 10 },
  emptySubtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  emptyLink: { color: '#3b82f6', fontWeight: '600' },

  // FAB
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

  // Create sheet
  createSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
    gap: 12,
  },
  createTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    borderRadius: 12,
    padding: 13,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#fafafa',
  },
  createButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 11 },
  cancelText: { color: '#6b7280', fontSize: 15, fontWeight: '500' },
  createBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 10,
  },
  createBtnDisabled: { backgroundColor: '#93c5fd' },
  createText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
