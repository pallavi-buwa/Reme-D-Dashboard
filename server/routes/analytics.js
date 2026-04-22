const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/summary', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM complaints').get().c;
  const open = db.prepare("SELECT COUNT(*) as c FROM complaints WHERE status NOT IN ('Resolved', 'Closed')").get().c;
  const escalated = db.prepare('SELECT COUNT(*) as c FROM complaints WHERE escalated = 1').get().c;
  const resolved = db.prepare("SELECT COUNT(*) as c FROM complaints WHERE status IN ('Resolved', 'Closed')").get().c;

  const byPriority = db.prepare(`
    SELECT priority, COUNT(*) as count FROM complaints GROUP BY priority ORDER BY priority ASC
  `).all();

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM complaints GROUP BY status ORDER BY count DESC
  `).all();

  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count FROM complaints WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC
  `).all();

  const byDevice = db.prepare(`
    SELECT device, COUNT(*) as count FROM complaints WHERE device IS NOT NULL GROUP BY device ORDER BY count DESC
  `).all();

  const byLabType = db.prepare(`
    SELECT lab_type, COUNT(*) as count FROM complaints WHERE lab_type IS NOT NULL GROUP BY lab_type ORDER BY count DESC
  `).all();

  const recentTrend = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM complaints
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY day
    ORDER BY day ASC
  `).all();

  const avgResolutionRaw = db.prepare(`
    SELECT
      c.id,
      c.created_at,
      sh.changed_at as resolved_at
    FROM complaints c
    JOIN status_history sh ON sh.complaint_id = c.id AND sh.to_status IN ('Resolved', 'Closed')
    ORDER BY sh.changed_at DESC
  `).all();

  let avgResolutionHours = null;
  if (avgResolutionRaw.length) {
    const totalMs = avgResolutionRaw.reduce((sum, row) => {
      return sum + (new Date(row.resolved_at) - new Date(row.created_at));
    }, 0);
    avgResolutionHours = Math.round((totalMs / avgResolutionRaw.length) / (1000 * 60 * 60));
  }

  res.json({
    summary: { total, open, escalated, resolved, avg_resolution_hours: avgResolutionHours },
    by_priority: byPriority,
    by_status: byStatus,
    by_category: byCategory,
    by_device: byDevice,
    by_lab_type: byLabType,
    trend_30d: recentTrend,
  });
});

module.exports = router;
