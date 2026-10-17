const { db } = require('../db');

/**
 * Calculates waiting time estimation for a token
 */
async function estimateWaitTime(deptId, tokenSortKey, isMovedUp = false) {
  const dept = await db.departments.findOne({ id: deptId });
  if (dept && dept.is_paused) {
    return {
      paused: true,
      pause_message: dept.pause_message || 'Queue is temporarily paused.',
      minutesFormatted: 'Paused'
    };
  }

  // Calculate average service time of last 5 served tokens today
  const todayStr = new Date().toISOString().slice(0, 10);
  const recentServed = await db.tokens.find(
    {
      dept_id: deptId,
      day: todayStr,
      status: 'SERVED',
      served_at: { $gt: 0 },
      called_at: { $gt: 0 }
    },
    { sort: { served_at: -1 }, limit: 5 }
  );

  let avgMinutes = 7;
  if (recentServed && recentServed.length > 0) {
    const totalDurationMs = recentServed.reduce((acc, t) => acc + (t.served_at - t.called_at), 0);
    const avgMs = totalDurationMs / recentServed.length;
    avgMinutes = Math.max(3, Math.min(20, Math.round(avgMs / 60000)));
  }

  // Count how many WAITING tokens are ahead in the queue
  // Priority order:
  // 1. moved_up_at (urgent)
  // 2. sort_key
  const waitingTokens = await db.tokens.find({
    dept_id: deptId,
    day: todayStr,
    status: 'WAITING'
  });

  // Calculate position ahead
  let peopleAhead = 0;
  for (const t of waitingTokens) {
    if (isMovedUp) {
      if (t.moved_up_at && t.moved_up_at < isMovedUp) {
        peopleAhead++;
      }
    } else {
      if (t.moved_up_at) {
        peopleAhead++; // all urgent tokens are ahead of non-urgent
      } else if (t.sort_key < tokenSortKey) {
        peopleAhead++;
      }
    }
  }

  const rawEstimate = peopleAhead * avgMinutes;
  if (peopleAhead === 0) {
    return {
      paused: false,
      peopleAhead: 0,
      position: 1,
      minWait: 0,
      maxWait: 5,
      minutesFormatted: 'Next in line (~ 5 mins)'
    };
  }

  const minWait = Math.max(5, Math.round((rawEstimate * 0.8) / 5) * 5);
  const maxWait = Math.max(minWait + 5, Math.round((rawEstimate * 1.25) / 5) * 5);

  return {
    paused: false,
    peopleAhead,
    position: peopleAhead + 1,
    minWait,
    maxWait,
    minutesFormatted: `~ ${minWait}–${maxWait} mins`
  };
}

module.exports = {
  estimateWaitTime
};
