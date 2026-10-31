require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const weightRoutes = require('./routes/weights');
const calorieRoutes = require('./routes/calories');
const goalRoutes = require('./routes/goals');
const settingsRoutes = require('./routes/settings');
const foodRoutes = require('./routes/foods');
const foodLogRoutes = require('./routes/foodLogs');
const dashboardRoutes = require('./routes/dashboard');
const bodyMetricRoutes = require('./routes/bodyMetrics');
const workoutRoutes = require('./routes/workouts');
const shareRoutes = require('./routes/shares');
const recipeRoutes = require('./routes/recipes');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fitness-coach';

// Render (and similar hosts) terminate HTTPS at the proxy.
app.set('trust proxy', 1);

// ---------- Middleware ----------
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 60 * 60 * 24 * 14 // 14 days
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 14,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// ---------- API routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/weights', weightRoutes);
app.use('/api/calories', calorieRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/food-logs', foodLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/body-metrics', bodyMetricRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/profile', require('./routes/profile'));
app.use('/api/social', require('./routes/social'));
app.use('/api/shared', require('./routes/shared'));
app.use('/api/comments', require('./routes/comments'));

// ---------- Static frontend ----------
app.use(express.static(path.join(__dirname, '../client')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ---------- Start ----------
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`Fitness Coach running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
