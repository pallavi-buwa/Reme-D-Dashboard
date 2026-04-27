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

function toSqliteDate(d) {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, minInclusive, maxInclusive) {
  return Math.floor(rng() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

function pick(rng, arr) {
  return arr[randInt(rng, 0, arr.length - 1)];
}

function pickMany(rng, arr, count) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < Math.min(count, copy.length); i++) {
    const idx = randInt(rng, 0, copy.length - 1);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function weightedPick(rng, items) {
  const total = items.reduce((acc, [, w]) => acc + w, 0);
  let r = rng() * total;
  for (const [value, weight] of items) {
    r -= weight;
    if (r <= 0) return value;
  }
  return items[items.length - 1][0];
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
      submitted_by_email TEXT,
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

    CREATE TABLE IF NOT EXISTS sla_configs (
      priority TEXT PRIMARY KEY,
      response_hours REAL NOT NULL DEFAULT 24,
      resolution_hours REAL NOT NULL DEFAULT 72,
      active INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: add submitted_by_email column if it doesn't exist yet
  try { db.exec('ALTER TABLE complaints ADD COLUMN submitted_by_email TEXT'); } catch { /* already exists */ }

  const userCount = get('SELECT COUNT(*) as c FROM users');
  if (userCount.c === 0) seedData();

  const slaCount = get('SELECT COUNT(*) as c FROM sla_configs');
  if (slaCount.c === 0) seedSlaDefaults();
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
    { name: 'Hospital Device Not Working → P0', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'device_status', op: 'eq', value: 'Not working/Completely non-functional' }, { field: 'lab_type', op: 'eq', value: 'Hospital' }] }), result_priority: 'P0', reasoning: 'Non-functional device in a hospital — direct patient care risk.', order_index: 1 },
    { name: 'Power Issue → P1', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'power_issue', op: 'eq', value: 'Yes' }] }), result_priority: 'P1', reasoning: 'Power failure detected — hardware intervention required immediately.', order_index: 2 },
    { name: 'IC Failure All Samples → P1', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'issue_type', op: 'contains', value: 'Internal Control (IC) failure/Not detected' }, { field: 'issue_consistency', op: 'eq', value: 'Consistent across all samples' }] }), result_priority: 'P1', reasoning: 'Internal control failure across all samples — systemic assay failure.', order_index: 3 },
    { name: 'No Amplification No FAM → P1', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'issue_type', op: 'contains', value: 'No amplification curve or visible (Flat line)' }, { field: 'fam_curve_visible', op: 'eq', value: 'No' }] }), result_priority: 'P1', reasoning: 'No amplification with no FAM curve — complete PCR failure.', order_index: 4 },
    { name: 'Low RFU All Samples → P1', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'issue_type', op: 'contains', value: 'Low signal intensity/Low RFU values' }, { field: 'issue_consistency', op: 'eq', value: 'Consistent across all samples' }] }), result_priority: 'P1', reasoning: 'Low signal/RFU across all samples — likely reagent or optics failure.', order_index: 5 },
    { name: 'Kit/Reagent Issue + Improper Storage → P2', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'contains', value: 'B: Kit/Reagent' }, { field: 'reagent_storage', op: 'eq', value: 'No' }] }), result_priority: 'P2', reasoning: 'Reagent stored improperly — likely root cause of assay failure.', order_index: 6 },
    { name: 'Protocol Not Followed → P2', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'protocol_followed', op: 'eq', value: 'No' }] }), result_priority: 'P2', reasoning: 'Standard protocol deviation — user training or protocol review required.', order_index: 7 },
    { name: 'Device Functional Single Sample → P3', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'device_status', op: 'eq', value: 'Fully functional' }, { field: 'issue_consistency', op: 'eq', value: 'Only 1 sample' }] }), result_priority: 'P3', reasoning: 'Device fully functional; issue limited to single sample — likely sample quality.', order_index: 8 },
  ];

  for (const r of priorityRules) {
    run('INSERT INTO priority_rules (name, conditions, result_priority, reasoning, order_index) VALUES (?, ?, ?, ?, ?)', r.name, r.conditions, r.result_priority, r.reasoning, r.order_index);
  }

  const routingRules = [
    { name: 'Machine/Device Failure → Technical Engineering', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'contains', value: 'A: Machine' }] }), assign_team: 'Technical Engineering', assign_role: 'technical_specialist', escalate: 0, order_index: 1 },
    { name: 'Kit/Reagent Issue → QC/Manufacturing', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'contains', value: 'B: Kit/Reagent' }] }), assign_team: 'QC / Manufacturing', assign_role: 'technical_specialist', escalate: 0, order_index: 2 },
    { name: 'Assay/Protocol Issue → Application Science', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'contains', value: 'C: Assay/Protocol' }] }), assign_team: 'Application Science', assign_role: 'technical_specialist', escalate: 0, order_index: 3 },
    { name: 'Environmental → Field Support', conditions: JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'contains', value: 'D: Environmental' }] }), assign_team: 'Field Support', assign_role: 'technical_specialist', escalate: 0, order_index: 4 },
    { name: 'PCR Device → PCR Specialist', conditions: JSON.stringify({ operator: 'OR', conditions: [{ field: 'device', op: 'eq', value: 'PseeR 16' }, { field: 'device', op: 'eq', value: 'PseeR 32' }, { field: 'device', op: 'eq', value: 'Portable PCR mini' }] }), assign_team: 'PCR Specialist Team', assign_role: 'technical_specialist', escalate: 0, order_index: 5 },
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

function getNextTicketIdForYear(year) {
  run('INSERT OR IGNORE INTO ticket_sequence (year, counter) VALUES (?, 0)', year);
  run('UPDATE ticket_sequence SET counter = counter + 1 WHERE year = ?', year);
  const { counter } = get('SELECT counter FROM ticket_sequence WHERE year = ?', year);
  return `RMD-${year}-${String(counter).padStart(4, '0')}`;
}

function seedProductionData(options = {}) {
  const multiplier = Number.isFinite(options.multiplier) ? options.multiplier : 10;
  const minTargetComplaints = Number.isFinite(options.minTargetComplaints) ? options.minTargetComplaints : 100;
  const seed = Number.isFinite(options.seed) ? options.seed : Date.now();

  const current = get('SELECT COUNT(*) as c FROM complaints').c || 0;
  const target = Math.max(current * multiplier, minTargetComplaints);
  const toAdd = target - current;
  if (toAdd <= 0) return { current, target, added: 0 };

  const rng = mulberry32((seed ^ (current + 1)) >>> 0);

  const users = all('SELECT id, name, role, region, active FROM users WHERE active = 1');
  const techUsers = users.filter(u => u.role === 'technical_specialist');
  const managerUsers = users.filter(u => u.role === 'account_manager');
  const adminUsers = users.filter(u => u.role === 'admin');

  const priorityRules = all('SELECT * FROM priority_rules');
  const routingRules = all('SELECT * FROM routing_rules');
  const { evaluatePriority } = require('./engines/priority');
  const { evaluateRouting } = require('./engines/routing');
  const { extractSignals } = require('./engines/signals');

  const regions = ['Cairo', 'Giza', 'Alexandria', 'Tanta', 'Mansoura', 'Aswan', 'Luxor', 'Suez', 'Ismailia', 'Port Said', 'Riyadh', 'Dubai', 'Nairobi', 'Lagos'];
  const labTypes = ['Hospital', 'Private Lab', 'Blood Bank', 'Clinic', 'Research Institute'];
  const devices = ['PseeR 16', 'PseeR 32', 'Portable PCR', 'Extractor'];
  const sampleTypes = ['Nasopharyngeal Swab', 'Blood', 'Saliva', 'Urine', 'Serum', 'Plasma'];
  const categories = ['Device Failure', 'Reagent Issue', 'Protocol Issue', 'Environmental'];
  const issueTypes = ['No amplification', 'IC failure', 'Low RFU', 'Abnormal curve', 'High background', 'Late Ct', 'Contamination suspected', 'Extraction failure'];
  const issueConsistency = ['Single sample', 'Multiple samples', 'All samples'];
  const deviceStatuses = ['Not working', 'Partially functional', 'Fully functional'];
  const processingTimes = ['<1h', '2-6h', '6-24h', '>24h'];

  function randomCreatedAt() {
    const daysBack = randInt(rng, 0, 365);
    const hoursBack = randInt(rng, 0, 23);
    const minutes = randInt(rng, 0, 59);
    return new Date(Date.now() - (daysBack * 24 + hoursBack) * 60 * 60 * 1000 - minutes * 60 * 1000);
  }

  function statusForAgeDays(ageDays) {
    if (ageDays <= 2) {
      return weightedPick(rng, [['New', 40], ['Triaged', 30], ['In Progress', 20], ['Waiting on Customer', 10]]);
    }
    if (ageDays <= 14) {
      return weightedPick(rng, [['Triaged', 20], ['In Progress', 45], ['Waiting on Customer', 20], ['Resolved', 15]]);
    }
    if (ageDays <= 60) {
      return weightedPick(rng, [['In Progress', 25], ['Waiting on Customer', 25], ['Resolved', 35], ['Closed', 15]]);
    }
    return weightedPick(rng, [['Resolved', 35], ['Closed', 55], ['Waiting on Customer', 10]]);
  }

  function contactForName(name) {
    const base = randInt(rng, 1000000, 9999999);
    return `+20-10${String(base).padStart(7, '0')}`;
  }

  function makeReporter() {
    const first = pick(rng, ['Ahmed', 'Sara', 'Mohammed', 'Mona', 'Youssef', 'Aisha', 'Omar', 'Nour', 'Hassan', 'Laila']);
    const last = pick(rng, ['Hassan', 'Ali', 'Khalil', 'Mostafa', 'Saeed', 'Ibrahim', 'Farouk', 'Shawky', 'Nassar', 'Abdelrahman']);
    const title = pick(rng, ['Dr.', 'Mr.', 'Ms.', 'Prof.']);
    const name = `${title} ${first} ${last}`;
    return { name, contact_number: contactForName(name) };
  }

  function chooseAssignedUser(role, region) {
    if (role === 'technical_specialist' && techUsers.length) return pick(rng, techUsers).id;
    if (role === 'account_manager' && managerUsers.length) {
      const regionMatch = managerUsers.find(u => u.region && region && String(region).includes(u.region));
      return (regionMatch || pick(rng, managerUsers)).id;
    }
    if (adminUsers.length) return pick(rng, adminUsers).id;
    return null;
  }

  exec('BEGIN');
  try {
    for (let i = 0; i < toAdd; i++) {
      const id = uuidv4();
      const createdAt = randomCreatedAt();
      const ageDays = Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
      const year = createdAt.getFullYear();
      const ticketId = getNextTicketIdForYear(year);

      const lab_type = pick(rng, labTypes);
      const device = pick(rng, devices);
      const category = pick(rng, categories);
      const region = rng() < 0.2 ? null : pick(rng, regions);

      const reporter = makeReporter();
      const sample_type = pick(rng, sampleTypes);
      const extraction_type = pick(rng, ['Automatic', 'Manual']);

      const selectedIssueTypes = pickMany(rng, issueTypes, randInt(rng, 1, 3));
      const consistency = weightedPick(rng, [[issueConsistency[0], 30], [issueConsistency[1], 45], [issueConsistency[2], 25]]);
      const device_status = weightedPick(rng, [[deviceStatuses[0], 20], [deviceStatuses[1], 35], [deviceStatuses[2], 45]]);
      const power_issue = rng() < 0.15 ? 'Yes' : 'No';
      const protocol_followed = rng() < 0.85 ? 'Yes' : 'No';
      const reagent_storage = rng() < 0.9 ? 'Yes' : 'No';
      const reagent_expiry = rng() < 0.8 ? 'Yes' : 'No';

      const sections = {
        'Reporter & Laboratory Information': { name: reporter.name, contact_number: reporter.contact_number, lab_type },
        'Sample & Extraction': {
          extraction_type,
          sample_type,
          blood_type: sample_type === 'Blood' ? pick(rng, ['EDTA', 'Serum', 'Heparin']) : undefined,
          protocol_followed,
          processing_time: pick(rng, processingTimes),
        },
        'Issue Description': {
          issue_type: selectedIssueTypes,
          issue_consistency: consistency,
          run_datetime: new Date(createdAt.getTime() - randInt(rng, 0, 6) * 60 * 60 * 1000).toISOString().slice(0, 16),
          fam_curve_visible: rng() < 0.75 ? 'Yes' : 'No',
          low_rfu: selectedIssueTypes.includes('Low RFU') ? 'Yes' : (rng() < 0.25 ? 'Yes' : 'No'),
        },
        'Issue Categorization & Severity': {
          category,
          user_priority: weightedPick(rng, [['P1 Critical', 10], ['P2 High', 35], ['P3 Medium', 55]]),
          device_status,
          power_issue,
        },
        'Controls & Standards': {
          efficiency: String(randInt(rng, 65, 98)),
          r_squared: (0.97 + rng() * 0.03).toFixed(3),
          slope: (-3.9 + rng() * 0.9).toFixed(2),
          ic_valid: selectedIssueTypes.includes('IC failure') ? 'No' : (rng() < 0.85 ? 'Yes' : 'No'),
          ct_value: weightedPick(rng, [['<26', 45], ['>26', 55]]),
        },
        'Device Details': {
          device,
          model_number: `${device.replace(/\s+/g, '-').toUpperCase()}-${randInt(rng, 2020, 2026)}`,
          serial_number: `SN-${randInt(rng, 100, 999)}-${randInt(rng, 10, 99)}`,
        },
        'Reagent Check': {
          reagent_storage,
          reagent_expiry,
          protocol_changes: rng() < 0.2 ? 'Yes' : 'No',
        },
        'Additional Info': {
          description: weightedPick(rng, [
            ['Issue observed during routine run; operator requests guidance and troubleshooting steps.', 35],
            ['Intermittent failures observed; requesting remote support and recommended checks.', 30],
            ['Multiple samples affected; lab operations impacted; needs quick resolution.', 25],
            ['Customer reports consistent failure after recent maintenance; requesting escalation.', 10],
          ]),
        },
      };

      const flat = Object.values(sections).reduce((acc, s) => ({ ...acc, ...s }), {});
      const signals = extractSignals(flat);

      const pr = evaluatePriority(flat, priorityRules);
      const routing = evaluateRouting(flat, pr.priority, routingRules);
      const primaryAssignment = routing.find(a => a.team) || null;

      const assigned_team = primaryAssignment?.team ?? null;
      const assigned_role = primaryAssignment?.role ?? null;
      const escalated = routing.some(a => a.escalate) ? 1 : 0;
      const assigned_to = (assigned_role && rng() < 0.85) ? chooseAssignedUser(assigned_role, region) : null;

      const status = statusForAgeDays(ageDays);

      const createdSql = toSqliteDate(createdAt);
      let updatedAt = new Date(createdAt.getTime() + randInt(rng, 1, Math.max(2, ageDays + 1)) * 60 * 60 * 1000);
      if (updatedAt.getTime() > Date.now()) updatedAt = new Date(Date.now() - randInt(rng, 0, 6) * 60 * 60 * 1000);
      const updatedSql = toSqliteDate(updatedAt);

      run(
        'INSERT INTO complaints (id,ticket_id,status,priority,priority_reasoning,priority_rule_name,category,device,lab_type,region,assigned_to,assigned_team,submitted_by_name,submitted_by_contact,escalated,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        id, ticketId, status, pr.priority, pr.reasoning, pr.rule_name,
        category, device, lab_type, region, assigned_to, assigned_team,
        reporter.name, reporter.contact_number, escalated, createdSql, updatedSql
      );

      for (const [sectionName, data] of Object.entries(sections)) {
        const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
        run('INSERT INTO section_responses (complaint_id, section_name, data) VALUES (?, ?, ?)', id, sectionName, JSON.stringify(cleaned));
      }

      run('INSERT INTO derived_signals (complaint_id, signals) VALUES (?, ?)', id, JSON.stringify(signals));

      const statusSteps = ['New', 'Triaged', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'];
      const targetIdx = Math.max(0, statusSteps.indexOf(status));
      let stepTime = new Date(createdAt.getTime());
      run(
        'INSERT INTO status_history (complaint_id, from_status, to_status, changed_by, notes, changed_at) VALUES (?, ?, ?, ?, ?, ?)',
        id, null, 'New', 'system', 'Complaint submitted via form', toSqliteDate(stepTime)
      );

      if (assigned_to) {
        const assignedAt = new Date(stepTime.getTime() + randInt(rng, 15, 240) * 60 * 1000);
        run(
          'INSERT INTO assignment_history (complaint_id, assigned_from, assigned_to, team, assigned_by, assigned_at) VALUES (?, ?, ?, ?, ?, ?)',
          id, null, assigned_to, assigned_team, 'system', toSqliteDate(assignedAt)
        );
      }

      let prev = 'New';
      for (let s = 1; s <= targetIdx; s++) {
        const next = statusSteps[s];
        stepTime = new Date(stepTime.getTime() + randInt(rng, 2, 72) * 60 * 60 * 1000);
        const note = next === 'Triaged'
          ? 'Auto-triaged by rules engine'
          : next === 'In Progress'
            ? 'Assigned engineer started investigation'
            : next === 'Waiting on Customer'
              ? 'Requested additional logs / run details from customer'
              : next === 'Resolved'
                ? 'Resolution provided; monitoring for recurrence'
                : 'Closed after customer confirmation';
        run(
          'INSERT INTO status_history (complaint_id, from_status, to_status, changed_by, notes, changed_at) VALUES (?, ?, ?, ?, ?, ?)',
          id, prev, next, 'system', note, toSqliteDate(stepTime)
        );
        prev = next;
      }

      const noteCount = weightedPick(rng, [[0, 55], [1, 30], [2, 12], [3, 3]]);
      for (let n = 0; n < noteCount; n++) {
        const author = pick(rng, users);
        const noteTime = new Date(createdAt.getTime() + randInt(rng, 1, Math.max(2, ageDays + 1)) * 24 * 60 * 60 * 1000);
        const noteText = weightedPick(rng, [
          ['Reviewed run metadata; requesting instrument logs for the affected run.', 30],
          ['Suggested reagent lot verification and repeat run with fresh controls.', 25],
          ['Advised power-cycle and optics calibration check; awaiting results.', 20],
          ['Customer confirmed issue persists; preparing escalation path.', 15],
          ['Follow-up: issue appears intermittent; monitoring next 3 runs.', 10],
        ]);
        run(
          'INSERT INTO internal_notes (complaint_id, user_id, user_name, note, created_at) VALUES (?, ?, ?, ?, ?)',
          id, author.id, author.name, noteText, toSqliteDate(noteTime)
        );
      }
    }

    exec('COMMIT');
  } catch (e) {
    exec('ROLLBACK');
    throw e;
  }

  const after = get('SELECT COUNT(*) as c FROM complaints').c || 0;
  return { current, target, added: toAdd, after, seed };
}

function seedSlaDefaults() {
  const defaults = [
    { priority: 'P0', response_hours: 2,  resolution_hours: 8   },
    { priority: 'P1', response_hours: 4,  resolution_hours: 24  },
    { priority: 'P2', response_hours: 24, resolution_hours: 72  },
    { priority: 'P3', response_hours: 72, resolution_hours: 168 },
  ];
  for (const d of defaults) {
    run('INSERT OR IGNORE INTO sla_configs (priority, response_hours, resolution_hours) VALUES (?, ?, ?)',
      d.priority, d.response_hours, d.resolution_hours);
  }
}

module.exports = { db, initDatabase, getNextTicketId, seedProductionData, run, get, all, exec };
