function initParams() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const msg = params.get('msg');

  if (status) {
    document.getElementById('demoStatusCode').textContent = `${status} ${status === '403' ? 'Forbidden' : status === '401' ? 'Unauthorized' : 'Access Denied'}`;
  }
  if (msg) {
    document.getElementById('demoErrorMessage').textContent = decodeURIComponent(msg);
  }
}

async function triggerSecurityTest(testType) {
  const consoleLog = document.getElementById('securityConsoleLog');
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
      age: -5, // rejected by Zod schema
      gender: 'M',
      complaint: 'Fever'
    });
  }

  try {
    const res = await fetch(endpoint, options);
    const body = await res.json().catch(() => ({}));

    // Update screen display elements
    document.getElementById('demoStatusCode').textContent = `${res.status} ${res.statusText}`;
    document.getElementById('demoErrorMessage').textContent = body.message || body.error || 'Server rejected request.';

    // Output formatted security log
    consoleLog.innerHTML = `
<span style="color: #4ade80;">[REQUEST]</span> ${options.method || 'GET'} ${endpoint}
<span style="color: #f87171;">[RESPONSE STATUS]</span> ${res.status} ${res.statusText}
<span style="color: #fbbf24;">[SECURITY RESPONSE BODY]</span>
${JSON.stringify(body, null, 2)}
    `.trim();

  } catch (err) {
    consoleLog.textContent = `Network / Execution Error: ${err.message}`;
  }
}

async function checkAdminSecurityAccess() {
  try {
    const res = await apiRequest('/api/auth/me');
    if (res && res.user && res.user.role === 'admin') {
      const consoleCard = document.getElementById('adminSecurityConsoleCard');
      if (consoleCard) consoleCard.style.display = 'block';
    }
  } catch (err) {
    // Not admin, keep console hidden
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initParams();
  checkAdminSecurityAccess();
});
