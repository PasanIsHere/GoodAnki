import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { DeckWithCounts, Card } from '@/src/types';
import { getDeckWithCounts, deleteDeck } from '@/src/db/queries/decks';
import { getCardsByDeck, deleteCard } from '@/src/db/queries/cards';

const CARD_DISPLAY_LIMIT = 150;

const STATE_CONFIG: Record<number, { label: string; color: string }> = {
  0: { label: 'New', color: '#3b82f6' },
  1: { label: 'Learning', color: '#f59e0b' },
  2: { label: 'Review', color: '#22c55e' },
  3: { label: 'Relearning', color: '#ef4444' },
};

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [deck, setDeck] = useState<DeckWithCounts | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    const [d, c] = await Promise.all([
      getDeckWithCounts(id),
      getCardsByDeck(id, CARD_DISPLAY_LIMIT),
    ]);
    setDeck(d);
    setCards(c);
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = () => {
    Alert.alert('Delete Deck', 'This will permanently delete all cards in this deck.', [
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
    Alert.alert('Delete Card', 'Remove this card from the deck?', [
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!deck) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.notFoundText}>Deck not found.</Text>
      </View>
    );
  }

  const dueTotal = deck.due_count + deck.new_count;

  const ListHeader = (
    <View>
      {/* Stats row */}
      <View style={styles.statsCard}>
        <StatItem value={deck.total_cards.toLocaleString()} label="Total" />
        <View style={styles.statDivider} />
        <StatItem value={deck.due_count.toString()} label="Due" color="#3b82f6" />
        <View style={styles.statDivider} />
        <StatItem value={deck.new_count.toString()} label="New" color="#f59e0b" />
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.studyBtn,
            dueTotal === 0 && styles.studyBtnDone,
            pressed && { opacity: 0.88 },
          ]}
          onPress={() => dueTotal > 0 && router.push(`/deck/${id}/review`)}
          disabled={dueTotal === 0}
        >
          <Text style={[styles.studyBtnText, dueTotal === 0 && styles.studyBtnTextDone]}>
            {dueTotal > 0 ? `Study Now  ·  ${dueTotal} cards` : '✓  All caught up'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.88 }]}
          onPress={() => router.push({ pathname: '/card/create', params: { deckId: id } })}
        >
          <Text style={styles.addBtnText}>+ Add Card</Text>
        </Pressable>
      </View>

      {/* Card list header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Cards{deck.total_cards > 0 ? ` (${deck.total_cards.toLocaleString()})` : ''}
        </Text>
        <Text style={styles.sectionHint}>Long press to delete</Text>
      </View>
    </View>
  );

  const ListFooter =
    deck.total_cards > CARD_DISPLAY_LIMIT ? (
      <Text style={styles.limitNote}>
        Showing first {CARD_DISPLAY_LIMIT.toLocaleString()} of {deck.total_cards.toLocaleString()} cards
      </Text>
    ) : null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: deck.name }} />

      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CardRow card={item} onLongPress={() => handleDeleteCard(item.id)} />
        )}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={
          <View style={styles.emptyCards}>
            <Text style={styles.emptyCardsText}>No cards yet. Tap + Add Card to get started.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={7}
        initialNumToRender={20}
      />

      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete Deck</Text>
      </Pressable>
    </View>
  );
}

function StatItem({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const CardRow = React.memo(function CardRow({
  card,
  onLongPress,
}: {
  card: Card;
  onLongPress: () => void;
}) {
  const cfg = STATE_CONFIG[card.state] ?? STATE_CONFIG[0];
  return (
    <Pressable
      style={({ pressed }) => [styles.cardRow, pressed && { opacity: 0.85 }]}
      onLongPress={onLongPress}
    >
      <View style={[styles.cardStateBar, { backgroundColor: cfg.color }]} />
      <View style={styles.cardContent}>
        <Text style={styles.cardFront} numberOfLines={1}>{card.front}</Text>
        <Text style={styles.cardBack} numberOfLines={1}>{card.back}</Text>
      </View>
      <Text style={[styles.cardStateLabel, { color: cfg.color }]}>{cfg.label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4ff' },
  notFoundText: { fontSize: 16, color: '#6b7280' },
  list: { paddingBottom: 80 },

  // Stats card
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '800', color: '#111827', lineHeight: 30 },
  statLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '500', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#f3f4f6', marginVertical: 4 },

  // Action buttons
  actionRow: { marginHorizontal: 16, marginTop: 12, gap: 10 },
  studyBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  studyBtnDone: {
    backgroundColor: '#f0fdf4',
    shadowOpacity: 0,
    elevation: 0,
  },
  studyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  studyBtnTextDone: { color: '#22c55e' },
  addBtn: {
    backgroundColor: '#fff',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  addBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHint: { fontSize: 11, color: '#d1d5db' },

  // Card rows
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardStateBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  cardContent: { flex: 1, paddingVertical: 11, paddingHorizontal: 12 },
  cardFront: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 2 },
  cardBack: { fontSize: 12, color: '#9ca3af' },
  cardStateLabel: { fontSize: 11, fontWeight: '600', paddingRight: 12 },

  emptyCards: { padding: 32, alignItems: 'center' },
  emptyCardsText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },

  limitNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    padding: 16,
  },

  deleteBtn: { padding: 16, alignItems: 'center' },
  deleteBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '500' },
});
