const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { db, getNextTicketId } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { extractSignals } = require('../engines/signals');
const { evaluatePriority } = require('../engines/priority');
const { evaluateRouting } = require('../engines/routing');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/complaints — public submission
router.post('/', upload.single('file'), (req, res) => {
  try {
    const sectionsRaw = req.body.sections;
    if (!sectionsRaw) return res.status(400).json({ error: 'Form data required' });

    const sections = JSON.parse(sectionsRaw);
    const flat = Object.values(sections).reduce((acc, s) => ({ ...acc, ...s }), {});

    const signals = extractSignals(flat);

    const priorityRules = db.prepare('SELECT * FROM priority_rules WHERE active = 1 ORDER BY order_index ASC').all();
    const priorityResult = evaluatePriority(flat, priorityRules);

    const routingRules = db.prepare('SELECT * FROM routing_rules WHERE active = 1 ORDER BY order_index ASC').all();
    const routingResults = evaluateRouting(flat, priorityResult.priority, routingRules);

    const primaryRoute = routingResults.find(r => !r.escalate);
    const escalated = routingResults.some(r => r.escalate) ? 1 : 0;

    const complaintId = uuidv4();
    const ticketId = getNextTicketId();

    db.prepare(`
      INSERT INTO complaints (id,ticket_id,status,priority,priority_reasoning,priority_rule_name,category,device,lab_type,region,assigned_team,submitted_by_name,submitted_by_contact,escalated)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      complaintId, ticketId, 'New',
      priorityResult.priority, priorityResult.reasoning, priorityResult.rule_name,
      flat.category, flat.device, flat.lab_type, flat.region || null,
      primaryRoute?.team || null,
      flat.name, flat.contact_number,
      escalated
    );

    for (const [sectionName, data] of Object.entries(sections)) {
      db.prepare('INSERT INTO section_responses (complaint_id, section_name, data) VALUES (?, ?, ?)').run(complaintId, sectionName, JSON.stringify(data));
    }

    db.prepare('INSERT INTO derived_signals (complaint_id, signals) VALUES (?, ?)').run(complaintId, JSON.stringify(signals));

    db.prepare("INSERT INTO status_history (complaint_id, from_status, to_status, changed_by, notes) VALUES (?, ?, ?, ?, ?)").run(complaintId, null, 'New', 'system', 'Complaint submitted via form');

    if (req.file) {
      db.prepare('INSERT INTO attachments (complaint_id, filename, original_name, file_path, file_size) VALUES (?, ?, ?, ?, ?)').run(
        complaintId, req.file.filename, req.file.originalname, req.file.path, req.file.size
      );
    }

    res.json({
      ticket_id: ticketId,
      complaint_id: complaintId,
      priority: priorityResult.priority,
      reasoning: priorityResult.reasoning,
      team: primaryRoute?.team || 'Unassigned',
      escalated: !!escalated,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submission failed', detail: err.message });
  }
});

// GET /api/complaints — list with filters (auth required)
router.get('/', authMiddleware, (req, res) => {
  const { priority, status, category, device, view, search, from, to } = req.query;

  let q = `
    SELECT c.*, u.name as assigned_name
    FROM complaints c
    LEFT JOIN users u ON c.assigned_to = u.id
    WHERE 1=1
  `;
  const params = [];

  if (priority) { q += ' AND c.priority = ?'; params.push(priority); }
  if (status) { q += ' AND c.status = ?'; params.push(status); }
  if (category) { q += ' AND c.category = ?'; params.push(category); }
  if (device) { q += ' AND c.device = ?'; params.push(device); }
  if (from) { q += ' AND date(c.created_at) >= ?'; params.push(from); }
  if (to) { q += ' AND date(c.created_at) <= ?'; params.push(to); }
  if (search) {
    q += ' AND (c.ticket_id LIKE ? OR c.submitted_by_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (view === 'mine') { q += ' AND c.assigned_to = ?'; params.push(req.user.id); }
  else if (view === 'unassigned') { q += ' AND c.assigned_to IS NULL'; }
  else if (view === 'escalated') { q += ' AND c.escalated = 1'; }

  q += ' ORDER BY c.created_at DESC LIMIT 500';

  const complaints = db.prepare(q).all(...params);
  res.json(complaints);
});

// GET /api/complaints/export — CSV export
router.get('/export', authMiddleware, (req, res) => {
  const complaints = db.prepare(`
    SELECT c.*, u.name as assigned_name
    FROM complaints c LEFT JOIN users u ON c.assigned_to = u.id
    ORDER BY c.created_at DESC
  `).all();

  const headers = ['ticket_id', 'status', 'priority', 'category', 'device', 'lab_type', 'region', 'submitted_by_name', 'submitted_by_contact', 'assigned_team', 'assigned_name', 'escalated', 'created_at'];
  const rows = complaints.map(c => headers.map(h => JSON.stringify(c[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="complaints.csv"');
  res.send(csv);
});

// GET /api/complaints/:id — single complaint detail
router.get('/:id', authMiddleware, (req, res) => {
  const complaint = db.prepare(`
    SELECT c.*, u.name as assigned_name, u.email as assigned_email
    FROM complaints c LEFT JOIN users u ON c.assigned_to = u.id
    WHERE c.id = ? OR c.ticket_id = ?
  `).get(req.params.id, req.params.id);

  if (!complaint) return res.status(404).json({ error: 'Not found' });

  const sections = db.prepare('SELECT section_name, data FROM section_responses WHERE complaint_id = ?').all(complaint.id);
  const signals = db.prepare('SELECT signals FROM derived_signals WHERE complaint_id = ?').get(complaint.id);
  const statusHistory = db.prepare('SELECT * FROM status_history WHERE complaint_id = ? ORDER BY changed_at ASC').all(complaint.id);
  const assignHistory = db.prepare('SELECT * FROM assignment_history WHERE complaint_id = ? ORDER BY assigned_at ASC').all(complaint.id);
  const notes = db.prepare('SELECT * FROM internal_notes WHERE complaint_id = ? ORDER BY created_at DESC').all(complaint.id);
  const attachments = db.prepare('SELECT * FROM attachments WHERE complaint_id = ?').all(complaint.id);

  res.json({
    ...complaint,
    sections: sections.map(s => ({ name: s.section_name, data: JSON.parse(s.data) })),
    signals: signals ? JSON.parse(signals.signals) : {},
    status_history: statusHistory,
    assignment_history: assignHistory,
    notes,
    attachments,
  });
});

// PATCH /api/complaints/:id — update status / assign
router.patch('/:id', authMiddleware, (req, res) => {
  const { status, assigned_to, notes } = req.body;
  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'Not found' });

  if (status && status !== complaint.status) {
    db.prepare("UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, complaint.id);
    db.prepare("INSERT INTO status_history (complaint_id, from_status, to_status, changed_by, notes) VALUES (?, ?, ?, ?, ?)").run(complaint.id, complaint.status, status, req.user.name, notes || null);
  }

  if (assigned_to !== undefined) {
    db.prepare("UPDATE complaints SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(assigned_to || null, complaint.id);
    db.prepare("INSERT INTO assignment_history (complaint_id, assigned_from, assigned_to, assigned_by) VALUES (?, ?, ?, ?)").run(complaint.id, complaint.assigned_to, assigned_to || null, req.user.name);
  }

  res.json({ ok: true });
});

// POST /api/complaints/:id/notes
router.post('/:id/notes', authMiddleware, (req, res) => {
  const { note } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Note required' });
  db.prepare('INSERT INTO internal_notes (complaint_id, user_id, user_name, note) VALUES (?, ?, ?, ?)').run(req.params.id, req.user.id, req.user.name, note.trim());
  res.json({ ok: true });
});

module.exports = router;
