import { getDatabase } from './database';
import { createDeck } from './queries/decks';
import { createCard } from './queries/cards';

const SAMPLE_CARDS = [
  {
    front: `<div style="font-size:1.3em;font-weight:700;color:#1d4ed8">What is the capital of France?</div>`,
    back: `<div style="font-size:2em;font-weight:800;color:#16a34a">🗼 Paris</div>`,
  },
  {
    front: `<div style="font-size:1.2em;color:#374151">What does <span style="background:#fef9c3;color:#92400e;padding:2px 8px;border-radius:4px;font-weight:700">HTML</span> stand for?</div>`,
    back: `<div style="font-weight:700;font-size:1.1em;color:#1e40af">HyperText Markup Language</div>`,
  },
  {
    front: `<div style="font-size:1.2em;font-weight:700;color:#374151">What is the powerhouse of the cell?</div>`,
    back: `<div style="display:inline-block;background:#dcfce7;color:#15803d;padding:8px 20px;border-radius:12px;font-size:1.4em;font-weight:800">⚡ Mitochondria</div>`,
  },
  {
    front: `<div style="font-size:1.1em;color:#374151;font-weight:600">Name the four nucleotide bases in DNA</div>`,
    back: `<div style="display:flex;flex-direction:column;gap:8px;align-items:center">
      <div style="background:#dbeafe;color:#1e40af;padding:6px 18px;border-radius:8px;font-weight:700">Adenine</div>
      <div style="background:#fce7f3;color:#9d174d;padding:6px 18px;border-radius:8px;font-weight:700">Thymine</div>
      <div style="background:#dcfce7;color:#166534;padding:6px 18px;border-radius:8px;font-weight:700">Guanine</div>
      <div style="background:#fef3c7;color:#92400e;padding:6px 18px;border-radius:8px;font-weight:700">Cytosine</div>
    </div>`,
  },
  {
    front: `<div style="font-size:1.2em;font-weight:700;color:#374151">What is Big O for <span style="font-family:monospace;background:#f1f5f9;padding:2px 8px;border-radius:4px;color:#6366f1">binary search</span>?</div>`,
    back: `<div style="font-family:monospace;font-size:2em;font-weight:800;color:#7c3aed">O(log n)</div>`,
  },
  {
    front: `<div style="font-size:1.2em;font-weight:700;color:#374151">What is the Pythagorean theorem?</div>`,
    back: `<div style="font-size:1.8em;font-weight:800;color:#dc2626;font-style:italic">a² + b² = c²</div>`,
  },
  {
    front: `<div style="font-weight:700;font-size:1.1em;color:#374151">What does <span style="color:#ef4444;font-weight:800">CRUD</span> stand for?</div>`,
    back: `<table style="border-collapse:collapse;font-size:0.95em">
      <tr><td style="padding:5px 12px;background:#fee2e2;color:#991b1b;font-weight:700;border-radius:4px">C</td><td style="padding:5px 10px;color:#374151">Create</td></tr>
      <tr><td style="padding:5px 12px;background:#fef3c7;color:#92400e;font-weight:700">R</td><td style="padding:5px 10px;color:#374151">Read</td></tr>
      <tr><td style="padding:5px 12px;background:#dcfce7;color:#166534;font-weight:700">U</td><td style="padding:5px 10px;color:#374151">Update</td></tr>
      <tr><td style="padding:5px 12px;background:#dbeafe;color:#1e40af;font-weight:700">D</td><td style="padding:5px 10px;color:#374151">Delete</td></tr>
    </table>`,
  },
  {
    front: `<div style="font-size:1.2em;font-weight:700;color:#374151">What is the speed of light?</div>`,
    back: `<div><div style="font-size:1.5em;font-weight:800;color:#0ea5e9">~300,000 km/s</div><div style="color:#6b7280;margin-top:6px;font-size:0.9em">186,000 mi/s &nbsp;·&nbsp; 3×10⁸ m/s</div></div>`,
  },
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
