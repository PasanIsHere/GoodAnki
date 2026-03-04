import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { Card, SwipeDirection } from '../../types';
import SwipeCard from './SwipeCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CardStackProps {
  cards: Card[];
  onSwipe: (card: Card, direction: SwipeDirection) => void;
}

const MAX_VISIBLE = 3;

export default function CardStack({ cards, onSwipe }: CardStackProps) {
  if (cards.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🎉</Text>
        <Text style={styles.emptyTitle}>All done!</Text>
        <Text style={styles.emptySubtitle}>No more cards to review right now.</Text>
      </View>
    );
  }

  const visibleCards = cards.slice(0, MAX_VISIBLE);

  return (
    <View style={styles.container}>
      {visibleCards.map((card, index) => (
        <SwipeCard
          key={card.id}
          card={card}
          isTop={index === 0}
          index={index}
          onSwipe={(direction) => onSwipe(card, direction)}
        />
      )).reverse()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});
