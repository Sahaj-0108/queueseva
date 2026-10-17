const express = require('express');
const { db } = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/audit');
const {
  getSortedQueue,
  callNextToken,
  markTokenServed,
  markTokenSkipped,
  moveTokenUp
} = require('../services/queueService');

const router = express.Router();

// 1. Get complete department queue (Staff / Admin)
router.get('/:dept', requireRole('staff', 'admin'), async (req, res) => {
  const deptId = req.params.dept.toUpperCase();
  const todayStr = new Date().toISOString().slice(0, 10);

  const dept = await db.departments.findOne({ id: deptId });
  if (!dept) {
    return res.status(404).json({ error: 'DEPT_NOT_FOUND', message: 'Department not found' });
  }

  const queue = await getSortedQueue(deptId, todayStr);

  // Combine and enrich active tokens
  const activeTokens = [...queue.called, ...queue.waiting, ...queue.skipped];

  const enriched = await Promise.all(
    activeTokens.map(async (t, index) => {
      const patient = await db.patients.findOne({ _id: t.patient_id });
      let doctor = null;
      if (t.doctor_id) {
        doctor = await db.doctors.findOne({ id: t.doctor_id });
      }

      return {
        id: t._id || t.id,
        code: t.code,
        dept_id: t.dept_id,
        status: t.status === 'CALLED' ? 'In Service' : t.status === 'WAITING' ? 'Waiting' : t.status,
        raw_status: t.status,
        position: t.status === 'WAITING' ? (queue.waiting.indexOf(t) + 1) : (t.status === 'CALLED' ? 1 : '-'),
        patient_name: patient ? patient.name : 'Unknown Patient',
        age: patient ? patient.age : '',
        gender: patient ? patient.gender : '',
        complaint: patient ? patient.complaint : '',
        allergies: patient ? patient.allergies : '',
        doctor_name: doctor ? doctor.name : '',
        is_urgent: !!t.moved_up_at,
        urgent_reason: t.urgent_reason || '',
        created_at: t.created_at,
        called_at: t.called_at
      };
    })
  );

  res.json({
    department: deptId,
    dept_name: dept.name_en,
    is_paused: !!dept.is_paused,
    pause_message: dept.pause_message || '',
    stats: {
      waiting: queue.waiting.length,
      in_service: queue.called.length,
      served: queue.served.length,
      skipped: queue.skipped.length,
      total: queue.total
    },
    tokens: enriched
  });
});

// 2. Call next token
router.post('/:dept/call-next', requireRole('staff', 'admin'), async (req, res) => {
  const deptId = req.params.dept.toUpperCase();
  try {
    const calledToken = await callNextToken(deptId, req);
    res.json({
      success: true,
      message: `Token ${calledToken.code} has been called!`,
      token: calledToken
    });
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.code || 'CALL_FAILED',
      message: err.message
    });
  }
});

// 3. Pause department queue
router.post('/:dept/pause', requireRole('staff', 'admin'), async (req, res) => {
  const deptId = req.params.dept.toUpperCase();
  const message = req.body.message || 'Queue paused by staff.';

  await db.departments.updateOne(
    { id: deptId },
    { $set: { is_paused: 1, pause_message: message } }
  );

  await logAudit(req, 'PAUSE_QUEUE', deptId, message);

  res.json({
    success: true,
    message: `Queue for ${deptId} is now paused.`,
    pause_message: message
  });
});

// 4. Resume department queue
router.post('/:dept/resume', requireRole('staff', 'admin'), async (req, res) => {
  const deptId = req.params.dept.toUpperCase();

  await db.departments.updateOne(
    { id: deptId },
    { $set: { is_paused: 0, pause_message: '' } }
  );

  await logAudit(req, 'RESUME_QUEUE', deptId);

  res.json({
    success: true,
    message: `Queue for ${deptId} has resumed.`
  });
});

// 5. Serve token
router.post('/token/:id/serve', requireRole('staff', 'doctor', 'admin'), async (req, res) => {
  try {
    const served = await markTokenServed(req.params.id, req);
    res.json({
      success: true,
      message: `Token ${served.code} marked as served.`,
      token: served
    });
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.code || 'SERVE_FAILED',
      message: err.message
    });
  }
});

// 6. Skip token
router.post('/token/:id/skip', requireRole('staff', 'admin'), async (req, res) => {
  try {
    const skipped = await markTokenSkipped(req.params.id, req);
    res.json({
      success: true,
      message: `Token ${skipped.code} marked as skipped (no-show).`,
      token: skipped
    });
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.code || 'SKIP_FAILED',
      message: err.message
    });
  }
});

// 7. Move token up (Urgent priority handling)
router.post('/token/:id/move-up', requireRole('staff', 'admin'), async (req, res) => {
  const { reason } = req.body;
  if (!reason) {
    return res.status(422).json({
      error: 'REASON_REQUIRED',
      message: 'Urgent priority handling requires a recorded reason.'
    });
  }

  try {
    const moved = await moveTokenUp(req.params.id, reason, req);
    res.json({
      success: true,
      message: `Token ${moved.code} moved to urgent front with reason: ${reason}.`,
      token: moved
    });
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.code || 'MOVE_FAILED',
      message: err.message
    });
  }
});

module.exports = router;
