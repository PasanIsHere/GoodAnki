import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Deck, Card } from '@/src/types';
import { getDeck, deleteDeck } from '@/src/db/queries/decks';
import { getCardsByDeck, deleteCard } from '@/src/db/queries/cards';
import { getDueCards } from '@/src/db/queries/cards';

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [dueCount, setDueCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!id) return;
    const [d, c, due] = await Promise.all([
      getDeck(id),
      getCardsByDeck(id),
      getDueCards(id),
    ]);
    setDeck(d);
    setCards(c);
    setDueCount(due.length);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = () => {
    Alert.alert('Delete Deck', 'Are you sure? This will delete all cards in this deck.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (id) {
            await deleteDeck(id);
            router.back();
          }
        },
      },
    ]);
  };

  const handleDeleteCard = (cardId: string) => {
    Alert.alert('Delete Card', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCard(cardId);
          loadData();
        },
      },
    ]);
  };

  if (!deck) return null;

  const stateLabels = ['New', 'Learning', 'Review', 'Relearning'];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: deck.name }} />

      <View style={styles.header}>
        <Text style={styles.description}>{deck.description || 'No description'}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{cards.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: '#3b82f6' }]}>{dueCount}</Text>
            <Text style={styles.statLabel}>Due</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {dueCount > 0 && (
            <Pressable
              style={styles.reviewBtn}
              onPress={() => router.push(`/deck/${id}/review`)}
            >
              <Text style={styles.reviewBtnText}>Review ({dueCount})</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push({ pathname: '/card/create', params: { deckId: id } })}
          >
            <Text style={styles.addBtnText}>Add Card</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.cardRow}
            onLongPress={() => handleDeleteCard(item.id)}
          >
            <View style={styles.cardContent}>
              <Text style={styles.cardFront} numberOfLines={1}>{item.front}</Text>
              <Text style={styles.cardBack} numberOfLines={1}>{item.back}</Text>
            </View>
            <Text style={styles.cardState}>{stateLabels[item.state]}</Text>
          </Pressable>
        )}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>Cards ({cards.length})</Text>
        }
        contentContainerStyle={styles.list}
      />

      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete Deck</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  description: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 12 },
  reviewBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  addBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addBtnText: { color: '#374151', fontSize: 16, fontWeight: '600' },
  list: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 8 },
  cardRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: { flex: 1, marginRight: 8 },
  cardFront: { fontSize: 15, fontWeight: '500', color: '#1f2937', marginBottom: 2 },
  cardBack: { fontSize: 13, color: '#6b7280' },
  cardState: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  deleteBtn: { padding: 16, alignItems: 'center' },
  deleteBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '500' },
});
