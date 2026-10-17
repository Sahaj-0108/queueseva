const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { db } = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { validateBody, COMPLAINT_CHOICES } = require('../middleware/validate');
const { logAudit } = require('../services/audit');
const { generateTokenCode, generateAccessCode } = require('../services/queueService');

const router = express.Router();

// Rate limiter for appointment booking: max 10 bookings per 10 minutes per IP
const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Booking limit reached from this IP. Please wait a few minutes before trying again.'
  }
});

const bookingSchema = z.object({
  dept_id: z.string().min(1, 'Department is required'),
  doctor_id: z.union([z.number(), z.string()]),
  slot_start: z.number().positive('Valid slot start timestamp is required'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  age: z.number().int().min(0, 'Age must be 0 or greater').max(120, 'Age must be 120 or less'),
  gender: z.enum(['M', 'F', 'O'], { errorMap: () => ({ message: 'Gender must be M, F, or O' }) }),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone number must be a valid 10-digit number'),
  complaint: z.string().min(1, 'Main complaint is required'),
  complaint_note: z.string().max(100, 'Complaint note max 100 characters').optional().default(''),
  allergies: z.string().max(100, 'Allergies note max 100 characters').optional().default(''),
  consent: z.literal(true, { errorMap: () => ({ message: 'You must provide consent to book an appointment' }) })
});

// Helper to generate readable Appointment ID: APT-XXXXX
function generateAppointmentId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `APT-${code}`;
}

// 1. Online booking (Public)
router.post('/', bookingLimiter, validateBody(bookingSchema), async (req, res) => {
  const {
    dept_id,
    doctor_id,
    slot_start,
    name,
    age,
    gender,
    phone,
    complaint,
    complaint_note,
    allergies,
    consent
  } = req.body;

  const docId = Number(doctor_id) || doctor_id;

  // 1. Check if doctor exists
  const doctor = await db.doctors.findOne({ id: docId });
  if (!doctor) {
    return res.status(404).json({ error: 'DOCTOR_NOT_FOUND', message: 'Selected doctor was not found.' });
  }

  // 2. Concurrency / Duplicate Slot check
  const existingSlotBooking = await db.appointments.findOne({
    doctor_id: docId,
    slot_start,
    status: { $in: ['BOOKED', 'CHECKED_IN', 'COMPLETED'] }
  });

  if (existingSlotBooking) {
    return res.status(409).json({
      error: 'SLOT_TAKEN',
      message: 'This slot was just booked by another patient. Please choose another available slot.'
    });
  }

  // 3. Duplicate booking prevention by phone: one active booking per doctor per day
  const bookingDateStr = new Date(slot_start).toISOString().slice(0, 10);
  const dayStart = new Date(`${bookingDateStr}T00:00:00`).getTime();
  const dayEnd = new Date(`${bookingDateStr}T23:59:59`).getTime();

  // Find patients with same phone
  const existingPatients = await db.patients.find({ phone });
  if (existingPatients && existingPatients.length > 0) {
    const patientIds = existingPatients.map(p => p._id || p.id);
    const existingPatientBooking = await db.appointments.findOne({
      patient_id: { $in: patientIds },
      doctor_id: docId,
      slot_start: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['BOOKED', 'CHECKED_IN'] }
    });

    if (existingPatientBooking) {
      return res.status(409).json({
        error: 'DUPLICATE_BOOKING',
        message: 'A booking already exists for this phone number with this doctor today.'
      });
    }
  }

  // 4. Create patient record
  const patient = await db.patients.insertOne({
    name,
    age,
    gender,
    phone,
    complaint,
    complaint_note: complaint_note || '',
    allergies: allergies || '',
    created_at: Date.now()
  });

  // 5. Generate appointment ID and 4-digit cancellation code
  const aptId = generateAppointmentId();
  const cancelCode = String(Math.floor(1000 + Math.random() * 9000));
  const cancelCodeHash = await bcrypt.hash(cancelCode, 10);

  const appointment = await db.appointments.insertOne({
    id: aptId,
    patient_id: patient._id || patient.id,
    doctor_id: docId,
    dept_id,
    slot_start,
    status: 'BOOKED',
    cancel_code_hash: cancelCodeHash,
    consent_at: Date.now(),
    created_at: Date.now()
  });

  await logAudit(req, 'BOOK_APPOINTMENT', aptId, {
    doctorId: docId,
    deptId: dept_id,
    slotStart: slot_start
  });

  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully!',
    appointment: {
      id: aptId,
      department: dept_id,
      doctor_name: doctor.name,
      doctor_room: doctor.room || 'Room 3',
      slot_start,
      slot_formatted: new Date(slot_start).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      date_formatted: new Date(slot_start).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      patient_name: name,
      patient_age: age,
      patient_gender: gender,
      cancellation_code: cancelCode // returned once for patient to save
    }
  });
});

// 2. View appointment details by ID + cancellation code
router.get('/:id', async (req, res) => {
  const apt = await db.appointments.findOne({ id: req.params.id });
  if (!apt) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Appointment not found.' });
  }

  // Verify access: either user is staff/admin or provided correct code
  const isStaffOrAdmin = req.session && ['staff', 'admin'].includes(req.session.role);
  const providedCode = req.query.code;

  if (!isStaffOrAdmin) {
    if (!providedCode) {
      return res.status(401).json({
        error: 'CODE_REQUIRED',
        message: 'Cancellation code is required to view appointment details.'
      });
    }
    const match = await bcrypt.compare(providedCode, apt.cancel_code_hash);
    if (!match) {
      return res.status(403).json({
        error: 'INVALID_CODE',
        message: 'Invalid cancellation code.'
      });
    }
  }

  const doctor = await db.doctors.findOne({ id: apt.doctor_id });
  const patient = await db.patients.findOne({ _id: apt.patient_id });

  res.json({
    appointment: {
      id: apt.id,
      status: apt.status,
      dept_id: apt.dept_id,
      doctor_name: doctor ? doctor.name : 'Unknown Doctor',
      doctor_room: doctor ? doctor.room : '',
      slot_start: apt.slot_start,
      patient_name: patient ? patient.name : '',
      patient_age: patient ? patient.age : '',
      patient_gender: patient ? patient.gender : '',
      complaint: patient ? patient.complaint : ''
    }
  });
});

// 3. Cancel appointment
router.post('/:id/cancel', async (req, res) => {
  const apt = await db.appointments.findOne({ id: req.params.id });
  if (!apt) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Appointment not found.' });
  }

  if (apt.status !== 'BOOKED') {
    return res.status(409).json({
      error: 'CANNOT_CANCEL',
      message: `Cannot cancel appointment with status '${apt.status}'. Only BOOKED appointments can be cancelled.`
    });
  }

  const isStaffOrAdmin = req.session && ['staff', 'admin'].includes(req.session.role);
  const providedCode = req.body.code || req.query.code;

  if (!isStaffOrAdmin) {
    if (!providedCode) {
      return res.status(401).json({
        error: 'CODE_REQUIRED',
        message: 'Cancellation code is required to cancel this appointment.'
      });
    }
    const match = await bcrypt.compare(providedCode, apt.cancel_code_hash);
    if (!match) {
      return res.status(403).json({
        error: 'INVALID_CODE',
        message: 'Invalid cancellation code.'
      });
    }
  }

  await db.appointments.updateOne({ id: apt.id }, { $set: { status: 'CANCELLED' } });
  await logAudit(req, 'CANCEL_APPOINTMENT', apt.id);

  res.json({
    success: true,
    message: 'Appointment successfully cancelled. The time slot has been released.'
  });
});

// 4. Staff/Admin list appointments
router.get('/', requireRole('staff', 'admin'), async (req, res) => {
  const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
  const search = (req.query.search || '').toLowerCase().trim();

  const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
  const dayEnd = new Date(`${dateStr}T23:59:59`).getTime();

  const appointments = await db.appointments.find({
    slot_start: { $gte: dayStart, $lte: dayEnd }
  });

  const doctors = await db.doctors.find({});
  const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d]));

  const enriched = await Promise.all(
    appointments.map(async (apt) => {
      const patient = await db.patients.findOne({ _id: apt.patient_id });
      const doctor = doctorMap[apt.doctor_id];

      return {
        id: apt.id,
        dept_id: apt.dept_id,
        doctor_name: doctor ? doctor.name : 'Unknown',
        doctor_room: doctor ? doctor.room : '',
        patient_name: patient ? patient.name : 'Unknown',
        patient_age: patient ? patient.age : '',
        patient_gender: patient ? patient.gender : '',
        patient_phone: patient ? patient.phone : '',
        complaint: patient ? patient.complaint : '',
        slot_start: apt.slot_start,
        slot_time: new Date(apt.slot_start).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        status: apt.status
      };
    })
  );

  // Filter search
  const filtered = enriched.filter(a => {
    if (!search) return true;
    return (
      a.id.toLowerCase().includes(search) ||
      a.patient_name.toLowerCase().includes(search) ||
      a.patient_phone.includes(search)
    );
  });

  res.json({ appointments: filtered });
});

// 5. Staff Check-In: Turns appointment into live token
router.post('/:id/check-in', requireRole('staff', 'admin'), async (req, res) => {
  const apt = await db.appointments.findOne({ id: req.params.id });
  if (!apt) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Appointment not found.' });
  }

  if (apt.status !== 'BOOKED') {
    return res.status(409).json({
      error: 'ALREADY_PROCESSED',
      message: `Appointment is already '${apt.status}'. Cannot check in again.`
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const tokenCode = await generateTokenCode(apt.dept_id, todayStr);
  const accessCode = generateAccessCode();
  const accessCodeHash = await bcrypt.hash(accessCode, 10);

  // Determine sort_key: on-time checkin uses slot time, late checkin uses current time
  const now = Date.now();
  const sortKey = apt.slot_start;

  const token = await db.tokens.insertOne({
    code: tokenCode,
    dept_id: apt.dept_id,
    day: todayStr,
    patient_id: apt.patient_id,
    doctor_id: apt.doctor_id,
    appointment_id: apt.id,
    access_code_hash: accessCodeHash,
    status: 'WAITING',
    sort_key: sortKey,
    moved_up_at: null,
    created_at: now,
    called_at: null,
    served_at: null
  });

  await db.appointments.updateOne({ id: apt.id }, { $set: { status: 'CHECKED_IN' } });

  await logAudit(req, 'CHECK_IN', tokenCode, {
    appointmentId: apt.id,
    deptId: apt.dept_id
  });

  res.json({
    success: true,
    message: 'Patient checked in successfully! Token issued.',
    token: {
      code: tokenCode,
      access_code: accessCode,
      dept_id: apt.dept_id,
      day: todayStr
    }
  });
});

module.exports = router;
