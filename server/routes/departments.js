const express = require('express');
const { db } = require('../db');
const { getSortedQueue } = require('../services/queueService');
const { estimateWaitTime } = require('../services/waitTime');

const router = express.Router();

router.get('/', async (req, res) => {
  const departments = await db.departments.find({});
  const todayStr = new Date().toISOString().slice(0, 10);

  const deptData = await Promise.all(
    departments.map(async (dept) => {
      const queue = await getSortedQueue(dept.id, todayStr);
      const currentlyServing = queue.called.length > 0 ? queue.called[queue.called.length - 1] : null;
      const nextTokens = queue.waiting.slice(0, 3).map(t => t.code);

      let waitTimeFormatted = '~ 15 mins';
      if (queue.waiting.length > 0) {
        const est = await estimateWaitTime(dept.id, queue.waiting[0].sort_key, !!queue.waiting[0].moved_up_at);
        waitTimeFormatted = est.minutesFormatted;
      } else {
        waitTimeFormatted = 'No wait';
      }

      return {
        id: dept.id,
        name_en: dept.name_en,
        name_gu: dept.name_gu,
        name_hi: dept.name_hi,
        is_paused: !!dept.is_paused,
        pause_message: dept.pause_message || '',
        queue_status: dept.is_paused ? 'Paused' : 'Normal',
        currently_serving: currentlyServing ? currentlyServing.code : '---',
        next_tokens: nextTokens,
        waiting_count: queue.waiting.length,
        in_service_count: queue.called.length,
        today_served_count: queue.served.length,
        total_count: queue.total,
        estimated_wait: waitTimeFormatted
      };
    })
  );

  res.json({ departments: deptData });
});

module.exports = router;
