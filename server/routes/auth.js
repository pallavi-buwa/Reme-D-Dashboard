const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { db } = require('../database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ── Login rate limiter ────────────────────────────────────────────────────────
// Max 10 attempts per IP per 15 minutes — blocks brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
  skipSuccessfulRequests: true, // Only counts failed attempts against the limit
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  // Normalise email and look up active user
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.toLowerCase().trim());

  // Use a consistent-time response regardless of whether user exists (prevents user enumeration)
  const dummyHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
  const hashToCheck = user ? user.password_hash : dummyHash;
  const valid = bcrypt.compareSync(password, hashToCheck);

  if (!user || !valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, region: user.region, team_id: user.team_id || null },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const userOut = { id: user.id, name: user.name, email: user.email, role: user.role, region: user.region, team_id: user.team_id || null };
  res.json({ token, user: userOut });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, region, team_id FROM users WHERE id = ? AND active = 1').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account not found or deactivated' });
  res.json(user);
});

module.exports = router;
