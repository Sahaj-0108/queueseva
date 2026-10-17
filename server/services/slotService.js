const { db } = require('../db');

/**
 * Generate 15-minute time slots for a doctor on a specific date (YYYY-MM-DD)
 */
async function getAvailableSlots(doctorId, dateStr) {
  const doctor = await db.doctors.findOne({ id: doctorId });
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  // Parse target date and weekday (0=Sun ... 6=Sat)
  const targetDate = new Date(`${dateStr}T00:00:00`);
  const weekday = targetDate.getDay();

  // Find schedule for this doctor and weekday
  const schedule = await db.schedules.findOne({ doctor_id: doctorId, weekday });
  if (!schedule) {
    return []; // No schedule on this day
  }

  const slotMinutes = schedule.slot_minutes || 15;
  const [startH, startM] = schedule.start_time.split(':').map(Number);
  const [endH, endM] = schedule.end_time.split(':').map(Number);

  const startMs = new Date(`${dateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`).getTime();
  const endMs = new Date(`${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`).getTime();

  // Generate all regular slots
  const allSlots = [];
  let current = startMs;
  while (current + slotMinutes * 60 * 1000 <= endMs) {
    const slotDate = new Date(current);
    const timeFormatted = slotDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const time24 = `${String(slotDate.getHours()).padStart(2, '0')}:${String(slotDate.getMinutes()).padStart(2, '0')}`;
    allSlots.push({
      slot_start: current,
      time: timeFormatted,
      time24
    });
    current += slotMinutes * 60 * 1000;
  }

  // Fetch already booked appointments for this doctor on this date
  const bookedAppointments = await db.appointments.find({
    doctor_id: doctorId,
    status: { $in: ['BOOKED', 'CHECKED_IN', 'COMPLETED'] }
  });

  const bookedStartTimes = new Set(bookedAppointments.map(a => Number(a.slot_start)));

  const now = Date.now();
  // Filter out booked and past slots if date is today
  return allSlots.map(slot => ({
    ...slot,
    available: !bookedStartTimes.has(slot.slot_start) && slot.slot_start > (now + 5 * 60 * 1000)
  }));
}

module.exports = {
  getAvailableSlots
};
