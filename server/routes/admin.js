const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, region, active, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

router.post('/users', requireRole('admin'), (req, res) => {
  const { name, email, password, role, region } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already exists' });
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, name, email, password_hash, role, region) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, email.toLowerCase(), bcrypt.hashSync(password, 10), role, region || null);
  res.json({ id });
});

router.patch('/users/:id', requireRole('admin'), (req, res) => {
  const { name, role, region, active, password } = req.body;
  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (role) { updates.push('role = ?'); params.push(role); }
  if (region !== undefined) { updates.push('region = ?'); params.push(region || null); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (password) { updates.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10)); }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

router.delete('/users/:id', requireRole('admin'), (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Priority Rules ────────────────────────────────────────────────────────────

router.get('/priority-rules', (req, res) => {
  res.json(db.prepare('SELECT * FROM priority_rules ORDER BY order_index ASC').all());
});

router.post('/priority-rules', requireRole('admin'), (req, res) => {
  const { name, conditions, result_priority, reasoning, active, order_index } = req.body;
  if (!name || !conditions || !result_priority) return res.status(400).json({ error: 'Missing fields' });
  try { JSON.parse(conditions); } catch { return res.status(400).json({ error: 'Invalid conditions JSON' }); }
  const info = db.prepare('INSERT INTO priority_rules (name, conditions, result_priority, reasoning, active, order_index) VALUES (?, ?, ?, ?, ?, ?)').run(name, conditions, result_priority, reasoning || null, active !== false ? 1 : 0, order_index || 100);
  res.json({ id: Number(info.lastInsertRowid) });
});

router.patch('/priority-rules/:id', requireRole('admin'), (req, res) => {
  const { name, conditions, result_priority, reasoning, active, order_index } = req.body;
  if (conditions) { try { JSON.parse(conditions); } catch { return res.status(400).json({ error: 'Invalid conditions JSON' }); } }
  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (conditions) { updates.push('conditions = ?'); params.push(conditions); }
  if (result_priority) { updates.push('result_priority = ?'); params.push(result_priority); }
  if (reasoning !== undefined) { updates.push('reasoning = ?'); params.push(reasoning); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (order_index !== undefined) { updates.push('order_index = ?'); params.push(order_index); }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id);
  db.prepare(`UPDATE priority_rules SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

router.delete('/priority-rules/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM priority_rules WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Routing Rules ─────────────────────────────────────────────────────────────

router.get('/routing-rules', (req, res) => {
  res.json(db.prepare('SELECT * FROM routing_rules ORDER BY order_index ASC').all());
});

router.post('/routing-rules', requireRole('admin'), (req, res) => {
  const { name, conditions, assign_team, assign_role, escalate, active, order_index } = req.body;
  if (!name || !conditions) return res.status(400).json({ error: 'Missing fields' });
  try { JSON.parse(conditions); } catch { return res.status(400).json({ error: 'Invalid conditions JSON' }); }
  const info = db.prepare('INSERT INTO routing_rules (name, conditions, assign_team, assign_role, escalate, active, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)').run(name, conditions, assign_team || null, assign_role || null, escalate ? 1 : 0, active !== false ? 1 : 0, order_index || 100);
  res.json({ id: Number(info.lastInsertRowid) });
});

router.patch('/routing-rules/:id', requireRole('admin'), (req, res) => {
  const { name, conditions, assign_team, assign_role, escalate, active, order_index } = req.body;
  if (conditions) { try { JSON.parse(conditions); } catch { return res.status(400).json({ error: 'Invalid conditions JSON' }); } }
  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (conditions) { updates.push('conditions = ?'); params.push(conditions); }
  if (assign_team !== undefined) { updates.push('assign_team = ?'); params.push(assign_team); }
  if (assign_role !== undefined) { updates.push('assign_role = ?'); params.push(assign_role); }
  if (escalate !== undefined) { updates.push('escalate = ?'); params.push(escalate ? 1 : 0); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (order_index !== undefined) { updates.push('order_index = ?'); params.push(order_index); }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id);
  db.prepare(`UPDATE routing_rules SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

router.delete('/routing-rules/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM routing_rules WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── SLA Configs ───────────────────────────────────────────────────────────────

router.get('/sla-configs', (req, res) => {
  res.json(db.prepare('SELECT * FROM sla_configs ORDER BY priority ASC').all());
});

router.patch('/sla-configs/:priority', requireRole('admin'), (req, res) => {
  const { priority } = req.params;
  if (!['P0', 'P1', 'P2', 'P3'].includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  const { response_hours, resolution_hours, active } = req.body;
  const updates = ['updated_at = CURRENT_TIMESTAMP'];
  const params = [];
  if (response_hours !== undefined) {
    const v = parseFloat(response_hours);
    if (!isFinite(v) || v <= 0) return res.status(400).json({ error: 'response_hours must be a positive number' });
    updates.push('response_hours = ?'); params.push(v);
  }
  if (resolution_hours !== undefined) {
    const v = parseFloat(resolution_hours);
    if (!isFinite(v) || v <= 0) return res.status(400).json({ error: 'resolution_hours must be a positive number' });
    updates.push('resolution_hours = ?'); params.push(v);
  }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
  params.push(priority);
  db.prepare(`UPDATE sla_configs SET ${updates.join(', ')} WHERE priority = ?`).run(...params);
  res.json({ ok: true });
});

module.exports = router;
