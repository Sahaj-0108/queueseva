const express = require('express');
const { db } = require('../db');
const { requireRole } = require('../middleware/auth');
const { getSortedQueue } = require('../services/queueService');

const router = express.Router();

// 1. Daily Summary Report (Admin only)
router.get('/summary', requireRole('admin'), async (req, res) => {
  const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
  const dayEnd = new Date(`${dateStr}T23:59:59`).getTime();

  // Appointments today
  const appointments = await db.appointments.find({
    slot_start: { $gte: dayStart, $lte: dayEnd }
  });

  const aptStats = {
    total: appointments.length,
    booked: appointments.filter(a => a.status === 'BOOKED').length,
    checked_in: appointments.filter(a => a.status === 'CHECKED_IN' || a.status === 'IN_SERVICE').length,
    completed: appointments.filter(a => a.status === 'COMPLETED').length,
    cancelled: appointments.filter(a => a.status === 'CANCELLED').length
  };

  // Queue stats per department
  const departments = await db.departments.find({});
  const deptStats = await Promise.all(
    departments.map(async (dept) => {
      const queue = await getSortedQueue(dept.id, dateStr);

      // Average wait time (called_at - created_at) for served tokens
      const servedTokens = queue.served.filter(t => t.called_at && t.created_at);
      let avgWaitMin = 0;
      if (servedTokens.length > 0) {
        const totalWaitMs = servedTokens.reduce((acc, t) => acc + (t.called_at - t.created_at), 0);
        avgWaitMin = Math.round(totalWaitMs / (servedTokens.length * 60000));
      }

      return {
        id: dept.id,
        name: dept.name_en,
        waiting: queue.waiting.length,
        in_service: queue.called.length,
        served: queue.served.length,
        skipped: queue.skipped.length,
        total: queue.total,
        avg_wait_minutes: avgWaitMin
      };
    })
  );

  res.json({
    date: dateStr,
    appointment_stats: aptStats,
    department_stats: deptStats
  });
});

// 2. Audit Log (Admin only)
router.get('/audit', requireRole('admin'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const logs = await db.audit_log.find({}, { sort: { time: -1 }, limit });
  res.json({ logs });
});

// 3. Security Events (Admin only)
router.get('/security', requireRole('admin'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const events = await db.security_events.find({}, { sort: { time: -1 }, limit });
  res.json({ events });
});

module.exports = router;
