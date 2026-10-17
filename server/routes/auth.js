const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { db } = require('../db');
const { logAudit } = require('../services/audit');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

// Rate limiter for login: max 5 failed attempts per 15 mins per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts total per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many login attempts from this IP address. Please try again after 15 minutes.'
  }
});

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  const user = await db.users.findOne({ username: username.toLowerCase().trim() });
  if (!user) {
    await logAudit(req, 'LOGIN_FAILED', username, 'User not found');
    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password.'
    });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    await logAudit(req, 'LOGIN_FAILED', username, 'Password mismatch');
    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password.'
    });
  }

  // Regenerate session to prevent session fixation attacks
  req.session.regenerate(async (err) => {
    if (err) {
      return res.status(500).json({ error: 'SESSION_ERROR', message: 'Could not create session.' });
    }

    req.session.userId = user._id || user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.displayName = user.display_name;
    req.session.doctorId = user.doctor_id || null;

    await logAudit(req, 'LOGIN_SUCCESS', username, { role: user.role });

    res.json({
      success: true,
      user: {
        id: req.session.userId,
        username: user.username,
        role: user.role,
        displayName: user.display_name,
        doctorId: user.doctor_id || null
      }
    });
  });
});

router.post('/logout', async (req, res) => {
  if (req.session && req.session.userId) {
    await logAudit(req, 'LOGOUT', req.session.username);
  }
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully.' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not logged in' });
  }

  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
      displayName: req.session.displayName,
      doctorId: req.session.doctorId
    }
  });
});

module.exports = router;
