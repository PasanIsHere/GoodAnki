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
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  form: { padding: 20, gap: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 90,
    textAlignVertical: 'top',
    color: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  addMoreBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  addMoreText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
