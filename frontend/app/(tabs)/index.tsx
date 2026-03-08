import React, { useCallback, useMemo, useRef, useState } from 'react';
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

// ── Tree data model ───────────────────────────────────────────────────────────

interface DeckNode {
  label: string;
  fullName: string;
  deck?: DeckWithCounts;
  children: DeckNode[];
  total_cards: number;
  due_count: number;
  new_count: number;
}

function buildTree(decks: DeckWithCounts[]): DeckNode[] {
  const sorted = [...decks].sort((a, b) => a.name.localeCompare(b.name));
  const root: DeckNode[] = [];

  for (const deck of sorted) {
    const parts = deck.name.split('::');
    let level = root;
    let fullPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      fullPath = fullPath ? `${fullPath}::${part}` : part;
      const isLeaf = i === parts.length - 1;

      let node = level.find(n => n.label === part);
      if (!node) {
        node = { label: part, fullName: fullPath, children: [], total_cards: 0, due_count: 0, new_count: 0 };
        level.push(node);
      }
      if (isLeaf) node.deck = deck;
      level = node.children;
    }
  }

  function aggregate(node: DeckNode) {
    for (const c of node.children) aggregate(c);
    node.total_cards = node.deck?.total_cards ?? 0;
    node.due_count = node.deck?.due_count ?? 0;
    node.new_count = node.deck?.new_count ?? 0;
    for (const c of node.children) {
      node.total_cards += c.total_cards;
      node.due_count += c.due_count;
      node.new_count += c.new_count;
    }
  }

  for (const node of root) aggregate(node);
  return root;
}

interface FlatItem {
  key: string;
  node: DeckNode;
  depth: number;
  hasChildren: boolean;
}

function flattenTree(nodes: DeckNode[], depth: number, expanded: Set<string>): FlatItem[] {
  const result: FlatItem[] = [];
  for (const node of nodes) {
    const hasChildren = node.children.length > 0;
    result.push({ key: node.fullName, node, depth, hasChildren });
    if (hasChildren && expanded.has(node.fullName)) {
      result.push(...flattenTree(node.children, depth + 1, expanded));
    }
  }
  return result;
}

// ── Tree row ──────────────────────────────────────────────────────────────────

const INDENT = 20;

const DeckRow = React.memo(function DeckRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: FlatItem;
  isExpanded: boolean;
  onToggle: (key: string) => void;
}) {
  const router = useRouter();
  const { node, depth, hasChildren } = item;
  const dueTotal = node.due_count + node.new_count;
  const isDone = dueTotal === 0;

  const handlePress = () => {
    if (hasChildren) {
      onToggle(node.fullName);
    } else if (node.deck) {
      router.push(`/deck/${node.deck.id}`);
    }
  };

  const handleNavigate = () => {
    if (node.deck) router.push(`/deck/${node.deck.id}`);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={handlePress}
      android_ripple={{ color: '#dbeafe' }}
    >
      {/* Indent + chevron/leaf indicator */}
      <View style={[styles.indentBlock, { width: 16 + depth * INDENT }]}>
        {depth > 0 && <View style={styles.indentLine} />}
      </View>

      {hasChildren ? (
        <Text style={styles.chevron}>{isExpanded ? '▾' : '▸'}</Text>
      ) : (
        <View style={styles.leafDot} />
      )}

      {/* Name + meta */}
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, depth === 0 && styles.rowNameRoot]} numberOfLines={2}>
          {node.label}
        </Text>
        <Text style={styles.rowMeta}>
          {node.total_cards.toLocaleString()} card{node.total_cards !== 1 ? 's' : ''}
          {isDone ? ' · All caught up' : ` · ${dueTotal} to study`}
        </Text>
      </View>

      {/* Right side: navigate button (if has deck) or due pill */}
      {hasChildren && node.deck ? (
        <Pressable onPress={handleNavigate} style={styles.navBtn} hitSlop={8}>
          <Text style={[styles.navBtnText, isDone && styles.navBtnTextDone]}>
            {isDone ? '✓' : dueTotal}
          </Text>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      ) : !hasChildren ? (
        isDone ? (
          <View style={styles.donePill}>
            <Text style={styles.doneText}>✓</Text>
          </View>
        ) : (
          <View style={styles.duePill}>
            <Text style={styles.duePillCount}>{dueTotal}</Text>
            <Text style={styles.duePillLabel}>due</Text>
          </View>
        )
      ) : (
        isDone ? null : (
          <View style={styles.duePillSmall}>
            <Text style={styles.duePillSmallText}>{dueTotal}</Text>
          </View>
        )
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  const tree = useMemo(() => buildTree(decks), [decks]);
  const flatItems = useMemo(() => flattenTree(tree, 0, expanded), [tree, expanded]);

  const handleToggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleCreateDeck = async () => {
    const name = newDeckName.trim();
    if (!name) return;
    await createDeck(name);
    setNewDeckName('');
    setShowCreate(false);
    loadDecks();
  };

  const renderItem = useCallback(
    ({ item }: { item: FlatItem }) => (
      <DeckRow item={item} isExpanded={expanded.has(item.key)} onToggle={handleToggle} />
    ),
    [expanded, handleToggle]
  );

  const keyExtractor = useCallback((item: FlatItem) => item.key, []);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#3b82f6" />
      ) : (
        <FlatList
          data={flatItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          removeClippedSubviews
          maxToRenderPerBatch={20}
          windowSize={7}
          initialNumToRender={20}
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
        <Pressable style={styles.fab} onPress={() => setShowCreate(true)}>
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
  list: { paddingTop: 8, paddingBottom: 110 },

  // Tree row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 3,
    borderRadius: 14,
    minHeight: 58,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  rowPressed: { opacity: 0.88 },

  indentBlock: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  indentLine: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: '#e5e7eb',
  },

  chevron: {
    fontSize: 16,
    color: '#3b82f6',
    width: 20,
    textAlign: 'center',
    marginRight: 4,
  },
  leafDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
    marginRight: 6,
    marginLeft: 7,
  },

  rowBody: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  rowNameRoot: {
    fontSize: 16,
    fontWeight: '700',
  },
  rowMeta: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // Nav button (parent node that is also a navigable deck)
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3b82f6',
  },
  navBtnTextDone: { color: '#22c55e' },
  navArrow: {
    fontSize: 20,
    color: '#93c5fd',
    marginTop: -1,
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
  duePillSmall: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 12,
  },
  duePillSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
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
