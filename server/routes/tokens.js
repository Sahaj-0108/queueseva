const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { db } = require('../db');
const { validateBody } = require('../middleware/validate');
const { logAudit } = require('../services/audit');
const { generateTokenCode, generateAccessCode, getSortedQueue } = require('../services/queueService');
const { estimateWaitTime } = require('../services/waitTime');

const router = express.Router();

const tokenStatusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many token status checks. Please wait a minute.' }
});

const walkInSchema = z.object({
  dept_id: z.string().min(1, 'Department is required'),
  name: z.string().min(2, 'Patient name is required').max(60),
  age: z.number().int().min(0, 'Age must be >= 0').max(120, 'Age must be <= 120'),
  gender: z.enum(['M', 'F', 'O']).optional().default('M'),
  phone: z.string().optional().default('9999999999'),
  complaint: z.string().min(1, 'Main complaint is required'),
  allergies: z.string().max(100).optional().default('')
});

// 1. Walk-in Token Generation (Patient / Staff) - Screen 3
router.post('/walk-in', validateBody(walkInSchema), async (req, res) => {
  const { dept_id, name, age, gender, phone, complaint, allergies } = req.body;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Check if department is paused
  const dept = await db.departments.findOne({ id: dept_id });
  if (!dept) {
    return res.status(404).json({ error: 'DEPT_NOT_FOUND', message: 'Department not found' });
  }

  // Create patient record
  const patient = await db.patients.insertOne({
    name,
    age,
    gender,
    phone,
    complaint,
    allergies: allergies || '',
    created_at: Date.now()
  });

  // Assign doctor if department has doctors (e.g. OPD)
  let doctorId = null;
  const doctors = await db.doctors.find({ dept_id });
  if (doctors && doctors.length > 0) {
    // Round-robin or pick first active doctor
    doctorId = doctors[0].id;
  }

  const tokenCode = await generateTokenCode(dept_id, todayStr);
  const accessCode = generateAccessCode();
  const accessCodeHash = await bcrypt.hash(accessCode, 10);
  const now = Date.now();

  const token = await db.tokens.insertOne({
    code: tokenCode,
    dept_id,
    day: todayStr,
    patient_id: patient._id || patient.id,
    doctor_id: doctorId,
    appointment_id: null,
    access_code_hash: accessCodeHash,
    status: 'WAITING',
    sort_key: now,
    moved_up_at: null,
    created_at: now,
    called_at: null,
    served_at: null
  });

  await logAudit(req, 'GENERATE_TOKEN', tokenCode, {
    deptId: dept_id,
    type: 'WALK_IN'
  });

  // Calculate position and wait time
  const waitInfo = await estimateWaitTime(dept_id, now, false);

  res.status(201).json({
    success: true,
    message: 'Token generated successfully!',
    token: {
      code: tokenCode,
      department: dept_id,
      patient_name: name,
      position: waitInfo.position,
      estimated_wait: waitInfo.minutesFormatted,
      access_code: accessCode, // given to user for privacy
      created_at: now
    }
  });
});

// 2. Track Token Live Status (Screen 4)
router.get('/status', tokenStatusLimiter, async (req, res) => {
  const code = (req.query.code || '').trim().toUpperCase();
  const accessCode = (req.query.access || '').trim();

  if (!code) {
    return res.status(422).json({ error: 'CODE_REQUIRED', message: 'Token code is required (e.g. OPD-024).' });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const token = await db.tokens.findOne({ code, day: todayStr });

  if (!token) {
    return res.status(404).json({
      error: 'TOKEN_NOT_FOUND',
      message: `Token '${code}' was not found for today. Please verify the token number.`
    });
  }

  // Check access authorization: staff/doctor or matched access code
  const isStaffOrDoctor = req.session && ['staff', 'doctor', 'admin'].includes(req.session.role);
  if (!isStaffOrDoctor && accessCode) {
    const isMatch = await bcrypt.compare(accessCode, token.access_code_hash);
    if (!isMatch) {
      return res.status(403).json({
        error: 'INVALID_ACCESS_CODE',
        message: 'Invalid 4-digit access code for this token.'
      });
    }
  }

  // Get department queue details
  const queue = await getSortedQueue(token.dept_id, todayStr);
  const currentlyServing = queue.called.length > 0 ? queue.called[queue.called.length - 1] : null;
  const nextTokens = queue.waiting.slice(0, 3).map(t => t.code);

  const dept = await db.departments.findOne({ id: token.dept_id });
  const waitInfo = await estimateWaitTime(token.dept_id, token.sort_key, !!token.moved_up_at);

  res.json({
    token_number: token.code,
    department: token.dept_id,
    status: token.status === 'CALLED' ? 'In Service' : token.status === 'WAITING' ? 'Waiting' : token.status,
    position_in_queue: token.status === 'WAITING' ? waitInfo.position : (token.status === 'CALLED' ? 0 : '-'),
    estimated_wait_time: waitInfo.minutesFormatted,
    queue_progress: {
      department: token.dept_id,
      currently_serving: currentlyServing ? currentlyServing.code : 'None',
      next_tokens: nextTokens,
      total_waiting: queue.waiting.length
    },
    is_paused: dept ? !!dept.is_paused : false,
    pause_message: dept ? dept.pause_message : ''
  });
});

module.exports = router;
