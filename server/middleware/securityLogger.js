const { db } = require('../db');

function securityLoggerMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  function checkAndLogSecurityEvent(body) {
    const status = res.statusCode;
    if ([401, 403, 409, 422, 429].includes(status)) {
      let reason = 'Security event';
      if (typeof body === 'object' && body !== null) {
        reason = body.message || body.error || JSON.stringify(body);
      } else if (typeof body === 'string') {
        reason = body;
      }

      const event = {
        time: Date.now(),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        user_id: req.session && req.session.userId ? req.session.userId : null,
        username: req.session && req.session.username ? req.session.username : 'anonymous',
        role: req.session && req.session.role ? req.session.role : 'unauthenticated',
        path: req.originalUrl || req.url,
        method: req.method,
        status,
        reason
      };

      db.security_events.insertOne(event).catch(err => {
        console.error('[SecurityLogger] Failed to record security event:', err);
      });
    }
  }

  res.json = function(data) {
    checkAndLogSecurityEvent(data);
    return originalJson(data);
  };

  res.send = function(data) {
    checkAndLogSecurityEvent(data);
    return originalSend(data);
  };

  next();
}

module.exports = { securityLoggerMiddleware };
