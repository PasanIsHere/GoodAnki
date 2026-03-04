import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { createDeck } from '@/src/db/queries/decks';
import { createCard } from '@/src/db/queries/cards';

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

export default function ImportScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<{ decks: ParsedDeck[]; total_cards: number } | null>(null);

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

    setIsLoading(true);
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

      const data = await response.json();
      setPreview(data);
    } catch (e: any) {
      Alert.alert('Import Error', e.message || 'Failed to connect to server. Is it running?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;

    setIsLoading(true);
    try {
      for (const parsedDeck of preview.decks) {
        const deck = await createDeck(parsedDeck.name, parsedDeck.description);
        for (const card of parsedDeck.cards) {
          await createCard(deck.id, card.front, card.back, card.tags);
        }
      }
      Alert.alert('Success', `Imported ${preview.total_cards} cards from ${preview.decks.length} deck(s).`);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save imported cards.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}

      {!preview ? (
        <View style={styles.pickerContainer}>
          <Text style={styles.title}>Import Anki Deck</Text>
          <Text style={styles.subtitle}>
            Select an .apkg file to import. The backend server must be running at {API_URL}.
          </Text>
          <Pressable style={styles.pickBtn} onPress={handlePickFile}>
            <Text style={styles.pickBtnText}>Choose .apkg File</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Text style={styles.title}>Preview Import</Text>
          {preview.decks.map((deck, i) => (
            <View key={i} style={styles.previewDeck}>
              <Text style={styles.previewDeckName}>{deck.name}</Text>
              <Text style={styles.previewDeckCount}>{deck.cards.length} cards</Text>
            </View>
          ))}
          <Text style={styles.totalText}>Total: {preview.total_cards} cards</Text>

          <View style={styles.previewActions}>
            <Pressable style={styles.cancelBtn} onPress={() => setPreview(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.importBtn} onPress={handleConfirmImport}>
              <Text style={styles.importBtnText}>Import</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6b7280' },
  pickerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 24 },
  pickBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  pickBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  previewContainer: { flex: 1, padding: 24 },
  previewDeck: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewDeckName: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  previewDeckCount: { fontSize: 14, color: '#6b7280' },
  totalText: { fontSize: 15, color: '#6b7280', marginTop: 8, marginBottom: 24 },
  previewActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  importBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  importBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
