const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'remed.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function toNum(v) {
  return typeof v === 'bigint' ? Number(v) : v;
}

function run(sql, ...params) {
  const result = db.prepare(sql).run(...params);
  return { changes: toNum(result.changes), lastInsertRowid: toNum(result.lastInsertRowid) };
}

function get(sql, ...params) {
  return db.prepare(sql).get(...params);
}

function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

function exec(sql) {
  return db.exec(sql);
}

function daysAgo(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      region TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      ticket_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'New',
      priority TEXT,
      priority_reasoning TEXT,
      priority_rule_name TEXT,
      category TEXT,
      device TEXT,
      lab_type TEXT,
      region TEXT,
      assigned_to TEXT,
      assigned_team TEXT,
      submitted_by_name TEXT,
      submitted_by_contact TEXT,
      escalated INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS section_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL,
      section_name TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS derived_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL UNIQUE,
      signals TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by TEXT,
      notes TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL,
      assigned_from TEXT,
      assigned_to TEXT,
      team TEXT,
      assigned_by TEXT,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS internal_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      note TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS priority_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      conditions TEXT NOT NULL,
      result_priority TEXT NOT NULL,
      reasoning TEXT,
      active INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 100,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS routing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      conditions TEXT NOT NULL,
      assign_team TEXT,
      assign_role TEXT,
      escalate INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 100,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ticket_sequence (
      year INTEGER PRIMARY KEY,
      counter INTEGER DEFAULT 0
    );
  `);

  const userCount = get('SELECT COUNT(*) as c FROM users');
  if (userCount.c === 0) seedData();
}

function getNextTicketId() {
  const year = new Date().getFullYear();
  run('INSERT OR IGNORE INTO ticket_sequence (year, counter) VALUES (?, 0)', year);
  run('UPDATE ticket_sequence SET counter = counter + 1 WHERE year = ?', year);
  const { counter } = get('SELECT counter FROM ticket_sequence WHERE year = ?', year);
  return `RMD-${year}-${String(counter).padStart(4, '0')}`;
}

function seedData() {
  const users = [
    { id: uuidv4(), name: 'Admin User', email: 'admin@remed.com', password: 'Admin@123', role: 'admin', region: null },
    { id: uuidv4(), name: 'Tech Specialist', email: 'specialist@remed.com', password: 'Spec@123', role: 'technical_specialist', region: null },
    { id: uuidv4(), name: 'Account Manager', email: 'manager@remed.com', password: 'Manager@123', role: 'account_manager', region: null },
    { id: uuidv4(), name: 'Egypt Account Manager', email: 'egypt@remed.com', password: 'Egypt@123', role: 'account_manager', region: 'Egypt' },
    { id: uuidv4(), name: 'Viewer User', email: 'viewer@remed.com', password: 'View@123', role: 'viewer', region: null },
  ];

  for (const u of users) {
    run('INSERT INTO users (id, name, email, password_hash, role, region) VALUES (?, ?, ?, ?, ?, ?)',
      u.id, u.name, u.email, bcrypt.hashSync(u.password, 10), u.role, u.region);
  }

  const priorityRules = [
    { name: 'Hospital Device Not Working → P0', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'device_status', op: 'eq', value: 'Not working' }, { field: 'lab_type', op: 'eq', value: 'Hospital' }] }), result_priority: 'P0', reasoning: 'Non-functional device in a hospital — direct patient care risk.', order_index: 1 },
    { name: 'Power Issue → P1', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'power_issue', op: 'eq', value: 'Yes' }] }), result_priority: 'P1', reasoning: 'Power failure detected — hardware intervention required immediately.', order_index: 2 },
    { name: 'IC Failure All Samples → P1', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'issue_type', op: 'contains', value: 'IC failure' }, { field: 'issue_consistency', op: 'eq', value: 'All samples' }] }), result_priority: 'P1', reasoning: 'Internal control failure across all samples — systemic assay failure.', order_index: 3 },
    { name: 'No Amplification No FAM → P1', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'issue_type', op: 'contains', value: 'No amplification' }, { field: 'fam_curve_visible', op: 'eq', value: 'No' }] }), result_priority: 'P1', reasoning: 'No amplification with no FAM curve — complete PCR failure.', order_index: 4 },
    { name: 'Low RFU All Samples → P1', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'issue_type', op: 'contains', value: 'Low RFU' }, { field: 'issue_consistency', op: 'eq', value: 'All samples' }] }), result_priority: 'P1', reasoning: 'Low RFU signal across all samples — likely reagent or optics failure.', order_index: 5 },
    { name: 'Reagent Issue Improper Storage → P2', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'eq', value: 'Reagent Issue' }, { field: 'reagent_storage', op: 'eq', value: 'No' }] }), result_priority: 'P2', reasoning: 'Reagent stored improperly — likely root cause of assay failure.', order_index: 6 },
    { name: 'Protocol Not Followed → P2', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'protocol_followed', op: 'eq', value: 'No' }] }), result_priority: 'P2', reasoning: 'Standard protocol deviation — user training or protocol review required.', order_index: 7 },
    { name: 'Device Functional Single Sample → P3', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'device_status', op: 'eq', value: 'Fully functional' }, { field: 'issue_consistency', op: 'eq', value: 'Single sample' }] }), result_priority: 'P3', reasoning: 'Device fully functional; issue limited to single sample — likely sample quality.', order_index: 8 },
  ];

  for (const r of priorityRules) {
    run('INSERT INTO priority_rules (name, conditions, result_priority, reasoning, order_index) VALUES (?, ?, ?, ?, ?)', r.name, r.conditions, r.result_priority, r.reasoning, r.order_index);
  }

  const routingRules = [
    { name: 'Device Failure → Technical Engineering', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'eq', value: 'Device Failure' }] }), assign_team: 'Technical Engineering', assign_role: 'technical_specialist', escalate: 0, order_index: 1 },
    { name: 'Reagent Issue → QC/Manufacturing', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'eq', value: 'Reagent Issue' }] }), assign_team: 'QC / Manufacturing', assign_role: 'technical_specialist', escalate: 0, order_index: 2 },
    { name: 'Protocol Issue → Application Science', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'eq', value: 'Protocol Issue' }] }), assign_team: 'Application Science', assign_role: 'technical_specialist', escalate: 0, order_index: 3 },
    { name: 'Environmental → Field Support', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'eq', value: 'Environmental' }] }), assign_team: 'Field Support', assign_role: 'technical_specialist', escalate: 0, order_index: 4 },
    { name: 'PCR Device → PCR Specialist', conditions: JSON.stringify({ operator: 'OR', conditions: [{ field: 'device', op: 'eq', value: 'PseeR 16' }, { field: 'device', op: 'eq', value: 'PseeR 32' }, { field: 'device', op: 'eq', value: 'Portable PCR' }] }), assign_team: 'PCR Specialist Team', assign_role: 'technical_specialist', escalate: 0, order_index: 5 },
    { name: 'Extractor Device → Extraction Specialist', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'device', op: 'eq', value: 'Extractor' }] }), assign_team: 'Extraction Specialist Team', assign_role: 'technical_specialist', escalate: 0, order_index: 6 },
    { name: 'P0/P1 → Escalate to Manager', conditions: JSON.stringify({ operator: 'OR', conditions: [{ field: 'priority', op: 'eq', value: 'P0' }, { field: 'priority', op: 'eq', value: 'P1' }] }), assign_team: null, assign_role: 'account_manager', escalate: 1, order_index: 7 },
  ];

  for (const r of routingRules) {
    run('INSERT INTO routing_rules (name, conditions, assign_team, assign_role, escalate, order_index) VALUES (?, ?, ?, ?, ?, ?)', r.name, r.conditions, r.assign_team, r.assign_role, r.escalate, r.order_index);
  }

  seedSampleComplaints(users);
}

function seedSampleComplaints(users) {
  const { extractSignals } = require('./engines/signals');
  const specId = users[1].id;

  const cases = [
    {
      id: uuidv4(), ticket_id: 'RMD-2024-0001', status: 'In Progress',
      priority: 'P0', priority_reasoning: 'Non-functional device in a hospital — direct patient care risk.', priority_rule_name: 'Hospital Device Not Working → P0',
      category: 'Device Failure', device: 'PseeR 32', lab_type: 'Hospital', region: 'Cairo',
      assigned_to: specId, assigned_team: 'Technical Engineering',
      submitted_by_name: 'Dr. Ahmed Hassan', submitted_by_contact: '+20-100-1234567', escalated: 1,
      daysAgo: 7,
      sections: {
        'Reporter & Laboratory Information': { name: 'Dr. Ahmed Hassan', contact_number: '+20-100-1234567', lab_type: 'Hospital' },
        'Sample & Extraction': { extraction_type: 'Automatic', sample_type: 'Nasopharyngeal Swab', protocol_followed: 'Yes', processing_time: '2-6h' },
        'Issue Description': { issue_type: ['No amplification', 'IC failure'], issue_consistency: 'All samples', run_datetime: '2024-01-15T10:30', fam_curve_visible: 'No', low_rfu: 'Yes' },
        'Issue Categorization & Severity': { category: 'Device Failure', user_priority: 'P1 Critical', device_status: 'Not working', power_issue: 'No' },
        'Controls & Standards': { efficiency: '85', r_squared: '0.998', slope: '-3.32', ic_valid: 'No', ct_value: '>26' },
        'Device Details': { device: 'PseeR 32', model_number: 'PSR-32-2023', serial_number: 'SN-001-2023' },
        'Reagent Check': { reagent_storage: 'Yes', reagent_expiry: 'No', protocol_changes: 'No' },
        'Additional Info': { description: 'Device stopped working mid-run. No amplification signal. All samples failed IC. Hospital diagnostics halted.' },
      },
    },
    {
      id: uuidv4(), ticket_id: 'RMD-2024-0002', status: 'New',
      priority: 'P2', priority_reasoning: 'Standard protocol deviation — user training or protocol review required.', priority_rule_name: 'Protocol Not Followed → P2',
      category: 'Protocol Issue', device: 'Extractor', lab_type: 'Private Lab', region: null,
      assigned_to: null, assigned_team: 'Application Science',
      submitted_by_name: 'Sara Khalil', submitted_by_contact: '+20-111-9876543', escalated: 0,
      daysAgo: 5,
      sections: {
        'Reporter & Laboratory Information': { name: 'Sara Khalil', contact_number: '+20-111-9876543', lab_type: 'Private Lab' },
        'Sample & Extraction': { extraction_type: 'Automatic', sample_type: 'Blood', blood_type: 'EDTA', protocol_followed: 'No', processing_time: '6-24h' },
        'Issue Description': { issue_type: ['Abnormal curve'], issue_consistency: 'Multiple samples', run_datetime: '2024-01-20T14:00', fam_curve_visible: 'Yes', low_rfu: 'No' },
        'Issue Categorization & Severity': { category: 'Protocol Issue', user_priority: 'P2 High', device_status: 'Fully functional', power_issue: 'No' },
        'Controls & Standards': { efficiency: '91', r_squared: '0.992', slope: '-3.45', ic_valid: 'Yes', ct_value: '<26' },
        'Device Details': { device: 'Extractor', model_number: 'EXT-2022', serial_number: 'SN-EXT-042' },
        'Reagent Check': { reagent_storage: 'Yes', reagent_expiry: 'Yes', protocol_changes: 'Yes' },
        'Additional Info': { description: 'Inconsistent extraction results after protocol was modified. Need guidance on correct procedure.' },
      },
    },
    {
      id: uuidv4(), ticket_id: 'RMD-2024-0003', status: 'Triaged',
      priority: 'P1', priority_reasoning: 'Low RFU signal across all samples — likely reagent or optics failure.', priority_rule_name: 'Low RFU All Samples → P1',
      category: 'Device Failure', device: 'PseeR 16', lab_type: 'Blood Bank', region: null,
      assigned_to: specId, assigned_team: 'Technical Engineering',
      submitted_by_name: 'Mohammed Ali', submitted_by_contact: '+20-122-5551234', escalated: 1,
      daysAgo: 3,
      sections: {
        'Reporter & Laboratory Information': { name: 'Mohammed Ali', contact_number: '+20-122-5551234', lab_type: 'Blood Bank' },
        'Sample & Extraction': { extraction_type: 'Manual', sample_type: 'Blood', blood_type: 'Serum', protocol_followed: 'Yes', processing_time: '<1h' },
        'Issue Description': { issue_type: ['Low RFU'], issue_consistency: 'All samples', run_datetime: '2024-01-22T09:15', fam_curve_visible: 'Yes', low_rfu: 'Yes' },
        'Issue Categorization & Severity': { category: 'Device Failure', user_priority: 'P2 High', device_status: 'Partially functional', power_issue: 'No' },
        'Controls & Standards': { efficiency: '72', r_squared: '0.981', slope: '-3.68', ic_valid: 'Yes', ct_value: '>26' },
        'Device Details': { device: 'PseeR 16', model_number: 'PSR-16-2022', serial_number: 'SN-016-019' },
        'Reagent Check': { reagent_storage: 'Yes', reagent_expiry: 'Yes', protocol_changes: 'No' },
        'Additional Info': { description: 'Consistently low RFU across all 16 wells. Optics or detector issue suspected.' },
      },
    },
  ];

  for (const c of cases) {
    const ts = daysAgo(c.daysAgo);
    run(
      'INSERT INTO complaints (id,ticket_id,status,priority,priority_reasoning,priority_rule_name,category,device,lab_type,region,assigned_to,assigned_team,submitted_by_name,submitted_by_contact,escalated,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      c.id, c.ticket_id, c.status, c.priority, c.priority_reasoning, c.priority_rule_name,
      c.category, c.device, c.lab_type, c.region, c.assigned_to, c.assigned_team,
      c.submitted_by_name, c.submitted_by_contact, c.escalated, ts, ts
    );

    for (const [sectionName, data] of Object.entries(c.sections)) {
      run('INSERT INTO section_responses (complaint_id, section_name, data) VALUES (?, ?, ?)', c.id, sectionName, JSON.stringify(data));
    }

    const flat = Object.values(c.sections).reduce((acc, s) => ({ ...acc, ...s }), {});
    run('INSERT INTO derived_signals (complaint_id, signals) VALUES (?, ?)', c.id, JSON.stringify(extractSignals(flat)));

    run('INSERT INTO status_history (complaint_id, from_status, to_status, changed_by, notes, changed_at) VALUES (?, ?, ?, ?, ?, ?)',
      c.id, null, 'New', 'system', 'Complaint submitted via form', ts);

    if (c.status !== 'New') {
      const ts2 = daysAgo(c.daysAgo - 1);
      run('INSERT INTO status_history (complaint_id, from_status, to_status, changed_by, notes, changed_at) VALUES (?, ?, ?, ?, ?, ?)',
        c.id, 'New', c.status, 'system', 'Auto-triaged by system', ts2);
    }
  }

  run('INSERT OR IGNORE INTO ticket_sequence (year, counter) VALUES (2024, 3)');
}

module.exports = { db, initDatabase, getNextTicketId, run, get, all, exec };
