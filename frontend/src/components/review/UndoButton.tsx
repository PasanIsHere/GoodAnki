import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

interface UndoButtonProps {
  onPress: () => void;
  disabled: boolean;
}

export default function UndoButton({ onPress, disabled }: UndoButtonProps) {
  return (
    <Pressable
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, disabled && styles.disabledText]}>Undo</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  disabledText: {
    color: '#9ca3af',
  },
});
