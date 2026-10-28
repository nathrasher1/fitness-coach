# Fitness Coach

Local multi-user fitness & nutrition coach.

**Current features**
- Multi-user accounts (register / login)
- Weight tracking + rolling averages + trends
- Food logging (search common foods + create custom foods)
- Daily calorie & macro totals
- Goal setting (lose / gain / maintain)
- Calorie + macro recommendations based on your actual weight change and intake

**Coming later**
- Meal suggestions generated from targets
- Workout logging
- Weight / reps recommendations based on training history

---

## Requirements

- Node.js 18+
- MongoDB running locally (you already have this)

## Setup

```bash
cd fitness-coach
cp .env.example .env
# Edit .env if you want a different MongoDB URI or session secret

npm install
npm run seed          # loads ~35 common foods
npm start             # http://localhost:3000
```

For development with auto-restart:

```bash
npm run dev
```

## Usage

1. Open http://localhost:3000
2. Create an account
3. Log weight regularly (same time of day is best)
4. Log food throughout the day
5. Set a goal
6. Check the Dashboard for recommended calories + macros

All data is stored in your local MongoDB and never leaves your machine.

## Project structure

```
fitness-coach/
├── server/
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API endpoints
│   ├── services/        # Recommendation logic
│   ├── middleware/
│   └── index.js
├── client/              # Frontend (HTML/CSS/JS)
├── data/seed.js         # Common foods seeder
└── package.json
```
