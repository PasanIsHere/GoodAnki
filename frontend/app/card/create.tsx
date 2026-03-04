import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createCard } from '@/src/db/queries/cards';

export default function CreateCardScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  const handleSave = async () => {
    if (!front.trim() || !back.trim() || !deckId) return;
    await createCard(deckId, front.trim(), back.trim());
    setFront('');
    setBack('');
  };

  const handleSaveAndClose = async () => {
    if (!front.trim() || !back.trim() || !deckId) return;
    await createCard(deckId, front.trim(), back.trim());
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.form}>
        <Text style={styles.label}>Front</Text>
        <TextInput
          style={styles.input}
          placeholder="Question or prompt..."
          value={front}
          onChangeText={setFront}
          multiline
          autoFocus
        />

        <Text style={styles.label}>Back</Text>
        <TextInput
          style={styles.input}
          placeholder="Answer..."
          value={back}
          onChangeText={setBack}
          multiline
        />

        <View style={styles.buttons}>
          <Pressable style={styles.addMoreBtn} onPress={handleSave}>
            <Text style={styles.addMoreText}>Save & Add Another</Text>
          </Pressable>
          <Pressable style={styles.saveBtn} onPress={handleSaveAndClose}>
            <Text style={styles.saveBtnText}>Save & Close</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  form: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  addMoreBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addMoreText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
