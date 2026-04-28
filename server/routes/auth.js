const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, region: user.region, team_id: user.team_id || null },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const userOut = { id: user.id, name: user.name, email: user.email, role: user.role, region: user.region, team_id: user.team_id || null };
  res.json({ token, user: userOut });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, region, team_id FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

module.exports = router;
