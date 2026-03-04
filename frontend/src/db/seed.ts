import { getDatabase } from './database';
import { createDeck } from './queries/decks';
import { createCard } from './queries/cards';

const SAMPLE_CARDS = [
  { front: 'What is the capital of France?', back: 'Paris' },
  { front: 'What is 2 + 2?', back: '4' },
  { front: 'What does HTML stand for?', back: 'HyperText Markup Language' },
  { front: 'Who painted the Mona Lisa?', back: 'Leonardo da Vinci' },
  { front: 'What is the largest planet in our solar system?', back: 'Jupiter' },
  { front: 'What year did World War II end?', back: '1945' },
  { front: 'What is the chemical symbol for water?', back: 'H₂O' },
  { front: 'Who wrote "Romeo and Juliet"?', back: 'William Shakespeare' },
  { front: 'What is the speed of light?', back: '~300,000 km/s (186,000 mi/s)' },
  { front: 'What is the powerhouse of the cell?', back: 'Mitochondria' },
  { front: 'What does CPU stand for?', back: 'Central Processing Unit' },
  { front: 'What is the derivative of x²?', back: '2x' },
  { front: 'Name the four nucleotide bases in DNA.', back: 'Adenine, Thymine, Guanine, Cytosine' },
  { front: 'What is Avogadro\'s number?', back: '6.022 × 10²³' },
  { front: 'What is the SI unit of force?', back: 'Newton (N)' },
  { front: 'What layer of the OSI model does TCP operate on?', back: 'Layer 4 (Transport)' },
  { front: 'What is Big O notation for binary search?', back: 'O(log n)' },
  { front: 'What does CRUD stand for?', back: 'Create, Read, Update, Delete' },
  { front: 'What is the Pythagorean theorem?', back: 'a² + b² = c²' },
  { front: 'What is the boiling point of water at sea level?', back: '100°C (212°F)' },
];

export async function seedDatabase(): Promise<void> {
  const db = await getDatabase();

  // Check if already seeded
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM decks');
  if (existing && existing.count > 0) return;

  const deck = await createDeck('Sample Deck', 'A collection of general knowledge cards for testing');

  for (const { front, back } of SAMPLE_CARDS) {
    await createCard(deck.id, front, back);
  }
}
