const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/audit');
const { generateTokenCode, generateAccessCode } = require('../services/queueService');

const router = express.Router();

// Helper to find token by ID or _id
async function findToken(id) {
  return await db.tokens.findOne({
    $or: [{ id: Number(id) || id }, { _id: id }, { code: id }]
  });
}

// 1. Get assigned patients for logged-in doctor
router.get('/patients', requireRole('doctor'), async (req, res) => {
  const doctorId = req.session.doctorId;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Fetch tokens assigned to this doctor for today
  const tokens = await db.tokens.find({
    doctor_id: doctorId,
    day: todayStr,
    status: { $in: ['WAITING', 'CALLED'] }
  });

  // Sort: CALLED first, then urgent, then sort_key
  tokens.sort((a, b) => {
    if (a.status === 'CALLED' && b.status !== 'CALLED') return -1;
    if (a.status !== 'CALLED' && b.status === 'CALLED') return 1;
    if (a.moved_up_at && !b.moved_up_at) return -1;
    if (!a.moved_up_at && b.moved_up_at) return 1;
    return a.sort_key - b.sort_key;
  });

  const enriched = await Promise.all(
    tokens.map(async (t) => {
      const patient = await db.patients.findOne({ _id: t.patient_id });
      return {
        id: t._id || t.id,
        code: t.code,
        dept_id: t.dept_id,
        status: t.status === 'CALLED' ? 'In Service' : 'Waiting',
        raw_status: t.status,
        patient_name: patient ? patient.name : 'Unknown',
        age: patient ? patient.age : '',
        gender: patient ? patient.gender : '',
        complaint: patient ? patient.complaint : '',
        allergies: patient ? patient.allergies : '',
        appointment_id: t.appointment_id || null,
        created_at: t.created_at,
        called_at: t.called_at
      };
    })
  );

  res.json({ patients: enriched });
});

// 2. View patient details (enforces ownership and logs VIEW_PATIENT)
router.get('/patients/:tokenId', requireRole('doctor'), async (req, res) => {
  const token = await findToken(req.params.tokenId);
  if (!token) {
    return res.status(404).json({ error: 'TOKEN_NOT_FOUND', message: 'Token not found.' });
  }

  // Enforce access control: doctor can only view own assigned patient
  if (token.doctor_id !== req.session.doctorId) {
    await logAudit(req, 'UNAUTHORIZED_PATIENT_ACCESS', token.code, {
      patientDoctor: token.doctor_id,
      requestingDoctor: req.session.doctorId
    });
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access denied: You can only view patients assigned to you.'
    });
  }

  const patient = await db.patients.findOne({ _id: token.patient_id });
  if (!patient) {
    return res.status(404).json({ error: 'PATIENT_NOT_FOUND', message: 'Patient data not found.' });
  }

  // Audit log patient record viewing
  await logAudit(req, 'VIEW_PATIENT', token.code, {
    patientId: patient._id || patient.id
  });

  res.json({
    token: {
      id: token._id || token.id,
      code: token.code,
      dept_id: token.dept_id,
      status: token.status === 'CALLED' ? 'In Service' : 'Waiting',
      raw_status: token.status,
      appointment_id: token.appointment_id
    },
    patient: {
      id: patient._id || patient.id,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      complaint: patient.complaint,
      complaint_note: patient.complaint_note || '',
      allergies: patient.allergies || 'None reported',
      phone: patient.phone ? patient.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : 'N/A' // masked
    }
  });
});

// 3. Mark consultation completed
router.post('/patients/:tokenId/complete', requireRole('doctor'), async (req, res) => {
  const token = await findToken(req.params.tokenId);
  if (!token) {
    return res.status(404).json({ error: 'TOKEN_NOT_FOUND', message: 'Token not found.' });
  }

  if (token.doctor_id !== req.session.doctorId) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You are not authorized to complete consultations for this patient.'
    });
  }

  const now = Date.now();
  await db.tokens.updateOne(
    { _id: token._id },
    { $set: { status: 'SERVED', served_at: now } }
  );

  if (token.appointment_id) {
    await db.appointments.updateOne(
      { id: token.appointment_id },
      { $set: { status: 'COMPLETED' } }
    );
  }

  await logAudit(req, 'COMPLETE_CONSULTATION', token.code, {
    durationMs: now - (token.called_at || now)
  });

  res.json({
    success: true,
    message: `Consultation for token ${token.code} marked as completed.`
  });
});

// 4. Refer patient to Laboratory or Pharmacy
router.post('/patients/:tokenId/refer', requireRole('doctor'), async (req, res) => {
  const { target_dept } = req.body;
  const deptId = (target_dept || '').toUpperCase();

  if (!['LAB', 'PHR'].includes(deptId)) {
    return res.status(422).json({
      error: 'INVALID_DEPARTMENT',
      message: 'Target referral department must be either LAB or PHR.'
    });
  }

  const token = await findToken(req.params.tokenId);
  if (!token) {
    return res.status(404).json({ error: 'TOKEN_NOT_FOUND', message: 'Token not found.' });
  }

  if (token.doctor_id !== req.session.doctorId) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You are not authorized to refer this patient.'
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const refTokenCode = await generateTokenCode(deptId, todayStr);
  const accessCode = generateAccessCode();
  const accessCodeHash = await bcrypt.hash(accessCode, 10);
  const now = Date.now();

  const refToken = await db.tokens.insertOne({
    code: refTokenCode,
    dept_id: deptId,
    day: todayStr,
    patient_id: token.patient_id,
    doctor_id: null,
    appointment_id: null,
    access_code_hash: accessCodeHash,
    status: 'WAITING',
    sort_key: now,
    moved_up_at: null,
    created_at: now,
    called_at: null,
    served_at: null
  });

  await logAudit(req, 'REFER_PATIENT', refTokenCode, {
    sourceToken: token.code,
    fromDept: token.dept_id,
    toDept: deptId
  });

  res.status(201).json({
    success: true,
    message: `Patient referred to ${deptId}. Token ${refTokenCode} issued.`,
    referral: {
      code: refTokenCode,
      dept_id: deptId,
      access_code: accessCode
    }
  });
});

module.exports = router;
