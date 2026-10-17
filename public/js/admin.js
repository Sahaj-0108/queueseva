async function checkAdminAuth() {
  try {
    const res = await apiRequest('/api/auth/me');
    if (!res.user || res.user.role !== 'admin') {
      window.location.href = '/unauthorized.html';
      return;
    }
    const header = document.getElementById('adminHeaderName');
    if (header) header.textContent = `${res.user.displayName || res.user.username} (ADMIN)`;
  } catch (err) {
    window.location.href = '/login.html';
  }
}

async function loadSummaryStats() {
  try {
    const data = await apiRequest('/api/reports/summary');
    const apts = data.appointment_stats;
    const depts = data.department_stats;

    document.getElementById('admBooked').textContent = apts.booked;
    document.getElementById('admCheckedIn').textContent = apts.checked_in;
    document.getElementById('admCompleted').textContent = apts.completed;

    const opdDept = depts.find(d => d.id === 'OPD');
    if (opdDept) {
      document.getElementById('admAvgWait').textContent = `${opdDept.avg_wait_minutes || 7} min`;
    }

    const deptTbody = document.getElementById('deptStatsBody');
    deptTbody.innerHTML = depts.map(d => `
      <tr>
        <td><strong>${d.name} (${d.id})</strong></td>
        <td><span class="badge badge-waiting">${d.waiting}</span></td>
        <td><span class="badge badge-service">${d.in_service}</span></td>
        <td><span class="badge badge-served">${d.served}</span></td>
        <td>${d.skipped}</td>
        <td><strong>${d.total}</strong></td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Failed to load summary stats:', err);
  }
}

async function loadAuditLogs() {
  const tbody = document.getElementById('auditTableBody');
  try {
    const res = await apiRequest('/api/reports/audit?limit=25');
    const logs = res.logs || [];

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No audit logs found.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const timeStr = new Date(l.time).toLocaleTimeString();
      return `
        <tr>
          <td><small>${timeStr}</small></td>
          <td><strong>${l.username}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${l.role})</span></td>
          <td><span class="badge badge-service">${l.action}</span></td>
          <td><code>${l.target || '-'}</code></td>
          <td><small>${l.detail || '-'}</small></td>
          <td><code>${l.ip || '127.0.0.1'}</code></td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">${err.message}</td></tr>`;
  }
}

async function loadSecurityEvents() {
  const tbody = document.getElementById('securityTableBody');
  try {
    const res = await apiRequest('/api/reports/security?limit=25');
    const events = res.events || [];

    if (events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No blocked security events recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = events.map(e => {
      const timeStr = new Date(e.time).toLocaleTimeString();
      return `
        <tr>
          <td><small>${timeStr}</small></td>
          <td><code>${e.ip}</code></td>
          <td>${e.username || 'anonymous'}</td>
          <td><code>${e.method} ${e.path}</code></td>
          <td><span class="badge badge-urgent">${e.status}</span></td>
          <td style="color: #b91c1c; font-size: 0.85rem;">${e.reason}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">${err.message}</td></tr>`;
  }
}

async function triggerAdminSecurityTest(testType) {
  const consoleLog = document.getElementById('adminSecurityConsoleLog');
  consoleLog.textContent = `Executing security test for HTTP ${testType}...`;

  let endpoint = '';
  let options = {
    headers: { 'Content-Type': 'application/json' }
  };

  if (testType === '401') {
    // 401 Unauthorized: Attempting to call protected staff queue API with no session
    endpoint = '/api/queue/OPD';
    options.method = 'GET';
  } else if (testType === '403') {
    // 403 Forbidden: Attempting to access doctor-restricted patient without doctor privileges
    endpoint = '/api/doctor/patients/OPD-018';
    options.method = 'GET';
  } else if (testType === '409') {
    // 409 Conflict: Attempting to serve a token that is in WAITING state (invalid state machine transition)
    endpoint = '/api/queue/token/OPD-024/serve';
    options.method = 'POST';
  } else if (testType === '422') {
    // 422 Unprocessable Entity: Submitting invalid age (-5) and script tag payload
    endpoint = '/api/tokens/walk-in';
    options.method = 'POST';
    options.body = JSON.stringify({
      dept_id: 'OPD',
      name: '<script>alert("xss")</script>Test',
      age: -5,
      gender: 'M',
      complaint: 'Fever'
    });
  }

  try {
    const res = await fetch(endpoint, options);
    const body = await res.json().catch(() => ({}));

    consoleLog.innerHTML = `
<span style="color: #4ade80;">[REQUEST]</span> ${options.method || 'GET'} ${endpoint}
<span style="color: #f87171;">[RESPONSE STATUS]</span> ${res.status} ${res.statusText}
<span style="color: #fbbf24;">[SECURITY RESPONSE BODY]</span>
${JSON.stringify(body, null, 2)}
    `.trim();

    // Auto-reload security events table so the blocked attempt immediately shows
    setTimeout(loadSecurityEvents, 500);

  } catch (err) {
    consoleLog.textContent = `Network / Execution Error: ${err.message}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  loadSummaryStats();
  loadAuditLogs();
  loadSecurityEvents();
});
