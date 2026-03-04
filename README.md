# GoodAnki

A mobile-first spaced repetition app with **Tinder-style swiping** for card review. Import your Anki decks, study with intuitive swipe gestures, and let the FSRS algorithm handle optimal scheduling — all offline.

Built with Expo (React Native), TypeScript, and a Python FastAPI backend for .apkg import/export.

---

## Features

### Swipe-Based Review
Swipe cards like Tinder — left, right, or up — to rate your recall. No tiny buttons, just natural gestures.

| Gesture | Rating | What it means |
|---------|--------|---------------|
| ← Swipe Left | **Again** | Forgot it. Short interval. |
| → Swipe Right | **Good** | Got it. Standard interval. |
| ↑ Swipe Up | **Easy** | Knew it instantly. Longer interval. |

- 3 stacked cards with smooth 60fps animations (Reanimated 3 + Gesture Handler)
- Color-coded overlays fade in as you swipe (red/green/blue)
- Tap to flip between front and back
- Haptic feedback on swipe confirmation

### FSRS Scheduling
Uses the **FSRS (Free Spaced Repetition Scheduler)** algorithm via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) — the same algorithm family used by Anki's FSRS optimizer. All scheduling runs on-device with zero latency.

- 4 card states: New → Learning → Review ↔ Relearning
- Configurable daily new card limit (default: 20)
- Smart queue priority: Learning > Due Reviews > New Cards
- Interval preview for each rating option

### Offline-First
Your data never leaves your device. The local SQLite database is the single source of truth.

- All reviews processed locally by ts-fsrs
- No network required for core functionality
- Backend only needed for .apkg import/export

### Anki Import/Export
Bring your existing Anki decks or export for use in desktop Anki.

- **Import:** Upload `.apkg` files → parsed on backend → saved to device
- **Export:** Deck data → `.apkg` file via genanki
- Handles multi-field note types, HTML stripping, and deck grouping

### Undo
Made a mistake? Undo any number of recent reviews. Each undo restores the card to its exact previous state, rolls back the review log, and adjusts daily stats.

### Stats Dashboard
- Today's reviews, new cards studied, and current streak
- Cards by state breakdown (New / Learning / Review / Relearning)
- 14-day review history bar chart
- Collection overview (total decks and cards)

### Full CRUD
- Create, edit, and delete decks
- Create cards with a "Save & Add Another" flow
- Card list view with state labels
- Long-press to delete individual cards

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo (managed), React Native 0.83, TypeScript |
| Navigation | Expo Router (file-based routing) |
| Animations | react-native-reanimated 4 + react-native-gesture-handler |
| Local DB | expo-sqlite (WAL mode, foreign keys) |
| State | Zustand |
| Scheduling | ts-fsrs (FSRS algorithm, on-device) |
| Backend | Python, FastAPI, uvicorn |
| Import | Manual SQLite parsing of .apkg files |
| Export | genanki (.apkg generation) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Python](https://python.org/) >= 3.11
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo`)
- iOS Simulator, Android Emulator, or [Expo Go](https://expo.dev/go) on a physical device

### Frontend

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `i` for iOS simulator / `a` for Android emulator.

On first launch, the app seeds a **Sample Deck** with 20 general knowledge cards so you can start swiping immediately.

### Backend (for .apkg import/export only)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Check `http://localhost:8000/health` to verify.

> The backend is **only** required for importing/exporting .apkg files. The core review experience works entirely offline.

---

## Project Structure

```
betteranki/
├── frontend/                           # Expo React Native app
│   ├── app/                            # Screens (file-based routing)
│   │   ├── (tabs)/
│   │   │   ├── index.tsx               # Deck list (home)
│   │   │   ├── stats.tsx               # Stats dashboard
│   │   │   └── settings.tsx            # Settings
│   │   ├── deck/
│   │   │   ├── [id].tsx                # Deck detail / card list
│   │   │   └── [id]/review.tsx         # Review session
│   │   ├── card/create.tsx             # Add card modal
│   │   └── import.tsx                  # Import .apkg modal
│   ├── src/
│   │   ├── components/review/          # SwipeCard, CardStack, SwipeOverlay
│   │   ├── db/
│   │   │   ├── database.ts             # SQLite init + migrations
│   │   │   ├── seed.ts                 # Sample data
│   │   │   └── queries/                # decks, cards, reviewLog, stats
│   │   ├── fsrs/scheduler.ts           # ts-fsrs wrapper
│   │   ├── hooks/useReviewSession.ts   # Review state machine
│   │   ├── stores/reviewStore.ts       # Zustand store
│   │   └── types/index.ts              # TypeScript types
│   └── package.json
│
├── backend/                            # Python FastAPI
│   ├── app/
│   │   ├── main.py                     # FastAPI app + CORS
│   │   ├── api/import_export.py        # POST /import, POST /export
│   │   └── services/
│   │       ├── apkg_parser.py          # .apkg → JSON
│   │       └── apkg_exporter.py        # JSON → .apkg
│   └── requirements.txt
└── .gitignore
```

---

## Database Schema

Four tables in the on-device SQLite database (`goodanki.db`):

**`decks`** — Deck metadata and configuration

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| name | TEXT | Deck name |
| description | TEXT | Optional description |
| new_cards_per_day | INTEGER | Daily new card limit (default: 20) |

**`cards`** — Card content + FSRS scheduling state

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| deck_id | TEXT FK | References decks(id) |
| front / back | TEXT | Card content |
| state | INTEGER | 0=New, 1=Learning, 2=Review, 3=Relearning |
| due | TEXT | Next review datetime (ISO 8601) |
| stability | REAL | FSRS stability parameter |
| difficulty | REAL | FSRS difficulty parameter |
| reps / lapses | INTEGER | Total reviews / times failed |

**`review_log`** — Append-only event log of every review

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| card_id | TEXT FK | References cards(id) |
| rating | INTEGER | 1=Again, 2=Hard, 3=Good, 4=Easy |
| state | INTEGER | Card state *before* review |
| synced | INTEGER | 0/1 flag for future sync |

**`daily_stats`** — Per-deck daily aggregates

| Column | Type | Description |
|--------|------|-------------|
| deck_id + date | PK | Composite key |
| new_cards_studied | INTEGER | New cards reviewed today |
| reviews_total | INTEGER | Total reviews today |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/import` | Upload .apkg → returns parsed JSON |
| POST | `/api/export` | Send deck JSON → returns .apkg file |

### Import

```bash
curl -X POST http://localhost:8000/api/import \
  -F "file=@my_deck.apkg"
```

Returns:
```json
{
  "decks": [
    {
      "name": "My Deck",
      "description": "",
      "cards": [
        { "front": "Question", "back": "Answer", "tags": "tag1 tag2" }
      ]
    }
  ],
  "total_cards": 42
}
```

### Export

```bash
curl -X POST http://localhost:8000/api/export \
  -H "Content-Type: application/json" \
  -d '{"name":"My Deck","cards":[{"front":"Q","back":"A"}]}' \
  --output my_deck.apkg
```

---

## Architecture Decisions

- **Offline-first:** Device SQLite is the source of truth. No network needed for reviews.
- **ts-fsrs on device:** Same FSRS algorithm as py-fsrs, maintained by the same org. Zero latency on review actions.
- **Backend exists only for import/export.** Parsing .apkg requires SQLite manipulation that's easier in Python.
- **Event-sourced reviews:** `review_log` is append-only with a `synced` flag — ready for future cloud sync without schema changes.
- **Undo via snapshot:** Each review log stores the card's state *before* the review, making rollback a simple restore.

---

## License

MIT
