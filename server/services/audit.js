const { db } = require('../db');

async function logAudit(req, action, target, detail = '') {
  try {
    const entry = {
      time: Date.now(),
      user_id: req && req.session && req.session.userId ? req.session.userId : null,
      username: req && req.session && req.session.username ? req.session.username : 'anonymous',
      role: req && req.session && req.session.role ? req.session.role : 'public',
      action,
      target: String(target || ''),
      detail: typeof detail === 'object' ? JSON.stringify(detail) : String(detail || ''),
      ip: req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : 'system'
    };
    await db.audit_log.insertOne(entry);
    return entry;
  } catch (err) {
    console.error('[AuditLog] Error recording audit:', err);
  }
}

module.exports = { logAudit };
