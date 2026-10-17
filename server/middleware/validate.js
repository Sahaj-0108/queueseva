const { z } = require('zod');

// Helper to sanitize strings from script tags and dangerous HTML
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>?/gm, '').trim();
}

function validateBody(schema) {
  return (req, res, next) => {
    try {
      // Basic sanitization of string values
      if (req.body && typeof req.body === 'object') {
        for (const [key, val] of Object.entries(req.body)) {
          if (typeof val === 'string') {
            req.body[key] = sanitizeString(val);
          }
        }
      }
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        return res.status(422).json({
          error: 'VALIDATION_ERROR',
          message: `Invalid input: ${issues}`,
          details: err.issues
        });
      }
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body'
      });
    }
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.query);
      req.query = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        return res.status(422).json({
          error: 'VALIDATION_ERROR',
          message: `Invalid query parameters: ${issues}`,
          details: err.issues
        });
      }
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid query parameters'
      });
    }
  };
}

// Common schemas
const COMPLAINT_CHOICES = [
  'Fever',
  'Cough/Cold',
  'Diabetes',
  'Blood Pressure',
  'Headache',
  'Skin',
  'Joint Pain',
  'Back pain',
  'Stomach',
  'General Check-up',
  'Other'
];

module.exports = {
  validateBody,
  validateQuery,
  sanitizeString,
  COMPLAINT_CHOICES
};
