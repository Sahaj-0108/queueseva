const { logAudit } = require('../services/audit');

function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Please log in to access this resource.'
    });
  }
  next();
}

function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.'
      });
    }

    if (!allowedRoles.includes(req.session.role)) {
      logAudit(req, 'FORBIDDEN_ATTEMPT', req.originalUrl, {
        requiredRoles: allowedRoles,
        actualRole: req.session.role
      });
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `You do not have permission to perform this action. Required role: ${allowedRoles.join(' or ')}.`
      });
    }

    next();
  };
}

module.exports = {
  requireLogin,
  requireRole
};
