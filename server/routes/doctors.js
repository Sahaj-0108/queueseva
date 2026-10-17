const express = require('express');
const { db } = require('../db');
const { getAvailableSlots } = require('../services/slotService');

const router = express.Router();

router.get('/', async (req, res) => {
  const query = {};
  if (req.query.dept) {
    query.dept_id = req.query.dept;
  }
  const doctors = await db.doctors.find(query);
  res.json({ doctors });
});

router.get('/:id/slots', async (req, res) => {
  const doctorId = Number(req.params.id) || req.params.id;
  const dateStr = req.query.date;

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(422).json({
      error: 'INVALID_DATE',
      message: 'Date must be formatted as YYYY-MM-DD'
    });
  }

  try {
    const slots = await getAvailableSlots(doctorId, dateStr);
    res.json({
      doctor_id: doctorId,
      date: dateStr,
      slots
    });
  } catch (err) {
    res.status(404).json({
      error: 'DOCTOR_NOT_FOUND',
      message: err.message
    });
  }
});

module.exports = router;
