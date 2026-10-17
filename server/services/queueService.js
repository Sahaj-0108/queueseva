const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { logAudit } = require('./audit');

/**
 * Generate next token code for department for today (e.g. OPD-024)
 */
async function generateTokenCode(deptId, dayStr) {
  const prefix = deptId === 'PHR' ? 'PH' : deptId;
  const count = await db.tokens.countDocuments({ dept_id: deptId, day: dayStr });
  const nextNum = count + 1;
  return `${prefix}-${String(nextNum).padStart(3, '0')}`;
}

/**
 * Generate 4-digit numeric access code
 */
function generateAccessCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Get sorted queue for a department for today
 */
async function getSortedQueue(deptId, dayStr) {
  const tokens = await db.tokens.find({ dept_id: deptId, day: dayStr });

  // Separate by status
  const waiting = tokens.filter(t => t.status === 'WAITING');
  const called = tokens.filter(t => t.status === 'CALLED');
  const served = tokens.filter(t => t.status === 'SERVED');
  const skipped = tokens.filter(t => t.status === 'SKIPPED');

  // Sort waiting: urgent first (moved_up_at), then sort_key
  waiting.sort((a, b) => {
    if (a.moved_up_at && !b.moved_up_at) return -1;
    if (!a.moved_up_at && b.moved_up_at) return 1;
    if (a.moved_up_at && b.moved_up_at) return a.moved_up_at - b.moved_up_at;
    return a.sort_key - b.sort_key;
  });

  return {
    waiting,
    called,
    served,
    skipped,
    total: tokens.length
  };
}

/**
 * Call next waiting token
 */
async function callNextToken(deptId, req) {
  const dept = await db.departments.findOne({ id: deptId });
  if (dept && dept.is_paused) {
    const err = new Error(`Cannot call next patient: ${dept.pause_message || 'Queue is paused'}`);
    err.status = 409;
    err.code = 'QUEUE_PAUSED';
    throw err;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const queue = await getSortedQueue(deptId, todayStr);

  if (queue.waiting.length === 0) {
    const err = new Error('No patients currently waiting in this queue.');
    err.status = 404;
    err.code = 'NO_PATIENTS_WAITING';
    throw err;
  }

  const nextToken = queue.waiting[0];
  const now = Date.now();

  await db.tokens.updateOne(
    { _id: nextToken._id },
    { $set: { status: 'CALLED', called_at: now } }
  );

  // If this token had an appointment, update appointment status if still checked_in
  if (nextToken.appointment_id) {
    await db.appointments.updateOne(
      { id: nextToken.appointment_id },
      { $set: { status: 'IN_SERVICE' } }
    );
  }

  await logAudit(req, 'CALL_TOKEN', nextToken.code, {
    deptId,
    patientId: nextToken.patient_id,
    calledAt: now
  });

  return {
    ...nextToken,
    status: 'CALLED',
    called_at: now
  };
}

/**
 * Mark token as served
 */
async function markTokenServed(tokenId, req) {
  const token = await db.tokens.findOne({ $or: [{ id: tokenId }, { _id: tokenId }, { code: tokenId }] });
  if (!token) {
    const err = new Error('Token not found.');
    err.status = 404;
    throw err;
  }

  if (token.status !== 'CALLED') {
    const err = new Error(`Cannot serve token with status '${token.status}'. Token must be CALLED first.`);
    err.status = 409;
    err.code = 'INVALID_TRANSITION';
    throw err;
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

  await logAudit(req, 'SERVE_TOKEN', token.code, {
    deptId: token.dept_id,
    durationMs: now - (token.called_at || now)
  });

  return { ...token, status: 'SERVED', served_at: now };
}

/**
 * Mark token as skipped (no show)
 */
async function markTokenSkipped(tokenId, req) {
  const token = await db.tokens.findOne({ $or: [{ id: tokenId }, { _id: tokenId }, { code: tokenId }] });
  if (!token) {
    const err = new Error('Token not found.');
    err.status = 404;
    throw err;
  }

  if (token.status !== 'CALLED' && token.status !== 'WAITING') {
    const err = new Error(`Cannot skip token with status '${token.status}'.`);
    err.status = 409;
    throw err;
  }

  await db.tokens.updateOne(
    { _id: token._id },
    { $set: { status: 'SKIPPED' } }
  );

  await logAudit(req, 'SKIP_TOKEN', token.code, {
    deptId: token.dept_id
  });

  return { ...token, status: 'SKIPPED' };
}

/**
 * Urgent handling: move token up in queue with mandatory reason
 */
async function moveTokenUp(tokenId, reason, req) {
  const validReasons = [
    'Senior citizen',
    'Pregnant',
    'Person with disability',
    'Staff-directed per hospital procedure'
  ];

  if (!validReasons.includes(reason)) {
    const err = new Error(`Invalid urgent reason. Must be one of: ${validReasons.join(', ')}`);
    err.status = 422;
    throw err;
  }

  const token = await db.tokens.findOne({ $or: [{ id: tokenId }, { _id: tokenId }, { code: tokenId }] });
  if (!token) {
    const err = new Error('Token not found.');
    err.status = 404;
    throw err;
  }

  if (token.status !== 'WAITING') {
    const err = new Error(`Cannot prioritize token with status '${token.status}'. Must be WAITING.`);
    err.status = 409;
    throw err;
  }

  const now = Date.now();
  await db.tokens.updateOne(
    { _id: token._id },
    { $set: { moved_up_at: now, urgent_reason: reason } }
  );

  await logAudit(req, 'MOVE_UP', token.code, {
    reason,
    deptId: token.dept_id
  });

  return { ...token, moved_up_at: now, urgent_reason: reason };
}

module.exports = {
  generateTokenCode,
  generateAccessCode,
  getSortedQueue,
  callNextToken,
  markTokenServed,
  markTokenSkipped,
  moveTokenUp
};
