import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { createDeck } from '@/src/db/queries/decks';
import { createCardsBatch } from '@/src/db/queries/cards';

const API_URL = 'http://localhost:8000';

interface ParsedCard {
  front: string;
  back: string;
  tags: string;
}

interface ParsedDeck {
  name: string;
  description: string;
  cards: ParsedCard[];
}

interface ParsedResult {
  decks: ParsedDeck[];
  total_cards: number;
}

type ImportPhase = 'idle' | 'uploading' | 'previewing' | 'importing' | 'done';

export default function ImportScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [preview, setPreview] = useState<ParsedResult | null>(null);
  const [importProgress, setImportProgress] = useState('');

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const file = result.assets[0];
    if (!file.name?.endsWith('.apkg')) {
      Alert.alert('Invalid file', 'Please select an .apkg file.');
      return;
    }

    setPhase('uploading');
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: 'application/octet-stream',
      } as any);

      const response = await fetch(`${API_URL}/api/import`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Import failed');
      }

      const data: ParsedResult = await response.json();
      setPreview(data);
      setPhase('previewing');
    } catch (e: any) {
      setPhase('idle');
      Alert.alert(
        'Import Error',
        e.message?.includes('fetch') || e.message?.includes('connect')
          ? `Could not reach the backend server at ${API_URL}.\n\nMake sure it is running:\n  cd backend\n  uvicorn app.main:app`
          : e.message || 'Failed to parse the .apkg file.'
      );
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setPhase('importing');

    try {
      for (let i = 0; i < preview.decks.length; i++) {
        const parsedDeck = preview.decks[i];
        setImportProgress(
          `Creating deck ${i + 1} of ${preview.decks.length}: "${parsedDeck.name}" (${parsedDeck.cards.length} cards)…`
        );
        const deck = await createDeck(parsedDeck.name, parsedDeck.description);
        await createCardsBatch(deck.id, parsedDeck.cards);
      }
      setPhase('done');
    } catch (e: any) {
      setPhase('previewing');
      Alert.alert('Error', 'Failed to save imported cards to the database.');
    }
  };

  // ─── Done ───────────────────────────────────────────────────────────────────
  if (phase === 'done' && preview) {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.doneIcon}>✓</Text>
        <Text style={styles.doneTitle}>Import complete!</Text>
        <Text style={styles.doneSub}>
          {preview.total_cards} cards across {preview.decks.length} deck{preview.decks.length !== 1 ? 's' : ''} added.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Go to Decks</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Importing ──────────────────────────────────────────────────────────────
  if (phase === 'importing') {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.importingTitle}>Importing…</Text>
        <Text style={styles.importingSub}>{importProgress}</Text>
      </View>
    );
  }

  // ─── Uploading / parsing ─────────────────────────────────────────────────────
  if (phase === 'uploading') {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.importingTitle}>Reading deck…</Text>
        <Text style={styles.importingSub}>Parsing .apkg file on server</Text>
      </View>
    );
  }

  // ─── Preview ─────────────────────────────────────────────────────────────────
  if (phase === 'previewing' && preview) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.previewScroll}>
          <Text style={styles.sectionHeader}>Decks to import</Text>

          {preview.decks.map((deck, i) => {
            const samples = deck.cards.slice(0, 3);
            return (
              <View key={i} style={styles.deckCard}>
                <View style={styles.deckCardHeader}>
                  <Text style={styles.deckCardName}>{deck.name}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{deck.cards.length}</Text>
                  </View>
                </View>

                {samples.length > 0 && (
                  <View style={styles.samplesContainer}>
                    <Text style={styles.samplesLabel}>Sample cards</Text>
                    {samples.map((card, j) => (
                      <View key={j} style={styles.sampleCard}>
                        <View style={styles.sampleSide}>
                          <Text style={styles.sampleSideLabel}>Q</Text>
                          <Text style={styles.sampleText} numberOfLines={2}>{card.front}</Text>
                        </View>
                        <View style={styles.sampleDivider} />
                        <View style={styles.sampleSide}>
                          <Text style={[styles.sampleSideLabel, { color: '#22c55e' }]}>A</Text>
                          <Text style={styles.sampleText} numberOfLines={3}>{card.back}</Text>
                        </View>
                      </View>
                    ))}
                    {deck.cards.length > 3 && (
                      <Text style={styles.moreCards}>+{deck.cards.length - 3} more cards</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <Text style={styles.totalText}>
            Total: {preview.total_cards} card{preview.total_cards !== 1 ? 's' : ''} across {preview.decks.length} deck{preview.decks.length !== 1 ? 's' : ''}
          </Text>
        </ScrollView>

        <View style={styles.previewActions}>
          <Pressable style={styles.cancelBtn} onPress={() => { setPreview(null); setPhase('idle'); }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.importBtn} onPress={handleConfirmImport}>
            <Text style={styles.importBtnText}>Import All</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Idle (pick file) ────────────────────────────────────────────────────────
  return (
    <View style={styles.centeredScreen}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>📦</Text>
      </View>
      <Text style={styles.idleTitle}>Import Anki Deck</Text>
      <Text style={styles.idleSub}>
        Select an .apkg file exported from Anki. The GoodAnki backend must be running.
      </Text>
      <Pressable style={styles.primaryBtn} onPress={handlePickFile}>
        <Text style={styles.primaryBtnText}>Choose .apkg File</Text>
      </Pressable>
      <View style={styles.serverHint}>
        <Text style={styles.serverHintLabel}>Backend URL</Text>
        <Text style={styles.serverHintValue}>{API_URL}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  centeredScreen: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },

  // Idle
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconText: { fontSize: 36 },
  idleTitle: { fontSize: 24, fontWeight: '700', color: '#1f2937', marginBottom: 10, textAlign: 'center' },
  idleSub: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  primaryBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  serverHint: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  serverHintLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  serverHintValue: { fontSize: 13, color: '#374151', fontFamily: 'monospace' },

  // Loading / importing
  importingTitle: { fontSize: 20, fontWeight: '600', color: '#1f2937', marginTop: 20, marginBottom: 8 },
  importingSub: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },

  // Done
  doneIcon: { fontSize: 56, color: '#22c55e', marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  doneSub: { fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 28 },

  // Preview
  previewScroll: { padding: 16, paddingBottom: 8 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  deckCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  deckCardName: { fontSize: 16, fontWeight: '600', color: '#1f2937', flex: 1, marginRight: 8 },
  countBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: { color: '#3b82f6', fontSize: 13, fontWeight: '700' },

  samplesContainer: { padding: 12, paddingTop: 8 },
  samplesLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  sampleCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden',
  },
  sampleSide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  sampleDivider: { height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 10 },
  sampleSideLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3b82f6',
    width: 16,
    marginTop: 1,
  },
  sampleText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 18 },
  moreCards: { fontSize: 12, color: '#9ca3af', marginTop: 4, textAlign: 'center' },

  totalText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginVertical: 8, paddingBottom: 8 },

  previewActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  importBtn: {
    flex: 2,
    backgroundColor: '#3b82f6',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  importBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
