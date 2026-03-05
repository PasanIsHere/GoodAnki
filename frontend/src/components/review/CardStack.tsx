import React, { useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, SwipeDirection } from '../../types';
import SwipeCard, { CARD_HEIGHT, CARD_WIDTH, SwipeCardHandle } from './SwipeCard';

export interface CardStackHandle {
  swipe: (direction: SwipeDirection) => void;
}

interface CardStackProps {
  cards: Card[];
  onSwipe: (card: Card, direction: SwipeDirection) => void;
}

const MAX_VISIBLE = 3;

const CardStack = React.memo(React.forwardRef<CardStackHandle, CardStackProps>(
  function CardStack({ cards, onSwipe }, ref) {
    const topCardRef = useRef<SwipeCardHandle>(null);

    useImperativeHandle(ref, () => ({
      swipe(direction: SwipeDirection) {
        topCardRef.current?.swipe(direction);
      },
    }));

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
        {visibleCards
          .map((card, index) => (
            <SwipeCard
              key={card.id}
              ref={index === 0 ? topCardRef : null}
              card={card}
              isTop={index === 0}
              index={index}
              onSwipe={(direction) => onSwipe(card, direction)}
            />
          ))
          .reverse()}
      </View>
    );
  }
));

export default CardStack;

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
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
