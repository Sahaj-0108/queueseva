let currentDept = 'OPD';
let targetMoveUpTokenId = null;
let appointmentsCache = [];

async function checkStaffAuth() {
  try {
    const res = await apiRequest('/api/auth/me');
    if (!res.user || (res.user.role !== 'staff' && res.user.role !== 'admin')) {
      window.location.href = '/unauthorized.html';
      return;
    }
    const welcome = document.getElementById('staffWelcomeName');
    if (welcome) welcome.textContent = `Welcome, ${res.user.displayName || res.user.username}`;
  } catch (err) {
    window.location.href = '/login.html';
  }
}

function switchView(viewName, linkElement) {
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  if (linkElement) linkElement.classList.add('active');

  const qView = document.getElementById('queueView');
  const aView = document.getElementById('appointmentsView');

  if (viewName === 'queue') {
    qView.style.display = 'block';
    aView.style.display = 'none';
    loadQueue();
  } else if (viewName === 'appointments') {
    qView.style.display = 'none';
    aView.style.display = 'block';
    loadAppointments();
  }
}

function changeDept(deptId, tabElement) {
  currentDept = deptId;
  document.querySelectorAll('.dept-tab-btn').forEach(btn => btn.classList.remove('active'));
  tabElement.classList.add('active');
  loadQueue();
}

async function loadQueue() {
  const tbody = document.getElementById('queueTableBody');
  try {
    const data = await apiRequest(`/api/queue/${currentDept}`);

    // Update Top Stats
    document.getElementById('statWaiting').textContent = data.stats.waiting;
    document.getElementById('statInService').textContent = data.stats.in_service;
    document.getElementById('statServed').textContent = data.stats.served;
    document.getElementById('statAppointments').textContent = data.stats.total;

    // Handle Paused state alert
    const pauseAlert = document.getElementById('deptPauseAlert');
    const pauseBtn = document.getElementById('pauseQueueBtn');

    if (data.is_paused) {
      pauseAlert.style.display = 'block';
      document.getElementById('deptPauseMsgText').textContent = data.pause_message || 'Queue is paused.';
      pauseBtn.textContent = '▶️ Resume Queue';
      pauseBtn.className = 'btn btn-success';
      pauseBtn.onclick = resumeQueueAction;
    } else {
      pauseAlert.style.display = 'none';
      pauseBtn.textContent = '⏸️ Pause Queue';
      pauseBtn.className = 'btn btn-secondary';
      pauseBtn.onclick = togglePauseModal;
    }

    const tokens = data.tokens || [];
    if (tokens.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No active tokens in this department.</td></tr>';
      return;
    }

    tbody.innerHTML = tokens.map(t => {
      let badgeClass = 'badge-waiting';
      if (t.raw_status === 'CALLED') badgeClass = 'badge-service';
      if (t.raw_status === 'SERVED') badgeClass = 'badge-served';
      if (t.raw_status === 'SKIPPED') badgeClass = 'badge-skipped';
      if (t.is_urgent) badgeClass = 'badge-urgent';

      let actionHtml = '';
      if (t.raw_status === 'CALLED') {
        actionHtml = `
          <button class="btn btn-primary btn-sm" onclick="serveTokenAction('${t.id}')">Complete</button>
          <button class="btn btn-secondary btn-sm" onclick="skipTokenAction('${t.id}')">Skip</button>
        `;
      } else if (t.raw_status === 'WAITING') {
        actionHtml = `
          <button class="btn btn-primary btn-sm" onclick="callDirectToken('${t.dept_id}')">Call Next</button>
          <button class="btn btn-secondary btn-sm" onclick="openUrgentModal('${t.id}', '${t.code}')">Move Up</button>
        `;
      } else {
        actionHtml = `<span style="color: var(--text-muted); font-size: 0.85rem;">Completed</span>`;
      }

      return `
        <tr>
          <td><strong>${t.code}</strong></td>
          <td>
            ${t.patient_name} ${t.age ? '(' + t.age + 'y)' : ''}
            ${t.is_urgent ? `<span class="badge badge-urgent" style="font-size: 0.75rem; margin-left: 0.35rem;">Urgent: ${t.urgent_reason}</span>` : ''}
          </td>
          <td>${t.position}</td>
          <td><span class="badge ${badgeClass}">${t.status}</span></td>
          <td>${actionHtml}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">${err.message}</td></tr>`;
  }
}

async function callNextTokenAction() {
  try {
    const res = await apiRequest(`/api/queue/${currentDept}/call-next`, { method: 'POST' });
    showToast(res.message, 'success');
    loadQueue();
  } catch (err) {
    showToast(err.message || 'Failed to call token', 'error');
  }
}

async function callDirectToken(dept) {
  try {
    const res = await apiRequest(`/api/queue/${dept}/call-next`, { method: 'POST' });
    showToast(res.message, 'success');
    loadQueue();
  } catch (err) {
    showToast(err.message || 'Failed to call token', 'error');
  }
}

async function serveTokenAction(tokenId) {
  try {
    const res = await apiRequest(`/api/queue/token/${tokenId}/serve`, { method: 'POST' });
    showToast(res.message, 'success');
    loadQueue();
  } catch (err) {
    showToast(err.message || 'Failed to serve token', 'error');
  }
}

async function skipTokenAction(tokenId) {
  try {
    const res = await apiRequest(`/api/queue/token/${tokenId}/skip`, { method: 'POST' });
    showToast(res.message, 'info');
    loadQueue();
  } catch (err) {
    showToast(err.message || 'Failed to skip token', 'error');
  }
}

// Pause & Resume
function togglePauseModal() {
  const modal = document.getElementById('pauseModal');
  modal.classList.toggle('show');
}

async function submitPauseQueue() {
  const reason = document.getElementById('pauseReasonInput').value.trim() || 'Queue paused by hospital staff.';
  try {
    const res = await apiRequest(`/api/queue/${currentDept}/pause`, {
      method: 'POST',
      body: JSON.stringify({ message: reason })
    });
    togglePauseModal();
    showToast(res.message, 'warning');
    loadQueue();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function resumeQueueAction() {
  try {
    const res = await apiRequest(`/api/queue/${currentDept}/resume`, { method: 'POST' });
    showToast(res.message, 'success');
    loadQueue();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Urgent Handling Modal
function openUrgentModal(tokenId, tokenCode) {
  targetMoveUpTokenId = tokenId;
  document.getElementById('urgentTokenCodeText').textContent = tokenCode;
  document.getElementById('urgentModal').classList.add('show');
}

function closeUrgentModal() {
  document.getElementById('urgentModal').classList.remove('show');
  targetMoveUpTokenId = null;
}

async function submitMoveUp() {
  if (!targetMoveUpTokenId) return;
  const reason = document.getElementById('urgentReasonSelect').value;

  try {
    const res = await apiRequest(`/api/queue/token/${targetMoveUpTokenId}/move-up`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    closeUrgentModal();
    showToast(res.message, 'success');
    loadQueue();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Walk-in Modal
function openWalkInModal() {
  document.getElementById('walkInModal').classList.add('show');
}
function closeWalkInModal() {
  document.getElementById('walkInModal').classList.remove('show');
}

async function handleStaffWalkIn(e) {
  e.preventDefault();
  const dept_id = document.getElementById('staffWalkInDept').value;
  const name = document.getElementById('staffWalkInName').value.trim();
  const age = parseInt(document.getElementById('staffWalkInAge').value, 10);
  const gender = document.getElementById('staffWalkInGender').value;
  const complaint = document.getElementById('staffWalkInComplaint').value;

  try {
    const res = await apiRequest('/api/tokens/walk-in', {
      method: 'POST',
      body: JSON.stringify({ dept_id, name, age, gender, complaint })
    });
    closeWalkInModal();
    showToast(`Token ${res.token.code} issued successfully! Access code: ${res.token.access_code}`, 'success');
    loadQueue();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Appointments List & Check-in
async function loadAppointments() {
  const tbody = document.getElementById('appointmentsTableBody');
  try {
    const res = await apiRequest('/api/appointments');
    appointmentsCache = res.appointments || [];
    renderAppointments(appointmentsCache);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger);">${err.message}</td></tr>`;
  }
}

function renderAppointments(list) {
  const tbody = document.getElementById('appointmentsTableBody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No appointments found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(a => {
    let statusBadge = `<span class="badge badge-waiting">${a.status}</span>`;
    let actionBtn = `<button class="btn btn-success btn-sm" onclick="checkInAppointment('${a.id}')">Check In</button>`;

    if (a.status === 'CHECKED_IN' || a.status === 'IN_SERVICE') {
      statusBadge = `<span class="badge badge-service">${a.status}</span>`;
      actionBtn = `<span style="color: var(--success); font-weight: 600; font-size: 0.85rem;">Checked In</span>`;
    } else if (a.status === 'COMPLETED') {
      statusBadge = `<span class="badge badge-served">COMPLETED</span>`;
      actionBtn = `<span style="color: var(--text-muted); font-size: 0.85rem;">Done</span>`;
    } else if (a.status === 'CANCELLED') {
      statusBadge = `<span class="badge badge-skipped">CANCELLED</span>`;
      actionBtn = `<span style="color: var(--text-muted); font-size: 0.85rem;">Cancelled</span>`;
    }

    return `
      <tr>
        <td><strong>${a.id}</strong></td>
        <td>${a.patient_name}</td>
        <td>${a.patient_age}y / ${a.patient_gender}</td>
        <td>${a.doctor_name}</td>
        <td>${a.slot_time}</td>
        <td>${statusBadge}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

function filterAppointments() {
  const query = document.getElementById('appointmentSearch').value.toLowerCase().trim();
  const filtered = appointmentsCache.filter(a => 
    a.id.toLowerCase().includes(query) ||
    a.patient_name.toLowerCase().includes(query) ||
    a.patient_phone.includes(query)
  );
  renderAppointments(filtered);
}

async function checkInAppointment(aptId) {
  try {
    const res = await apiRequest(`/api/appointments/${aptId}/check-in`, { method: 'POST' });
    showToast(`Checked In! Token ${res.token.code} issued (Access Code: ${res.token.access_code})`, 'success');
    loadAppointments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkStaffAuth();
  loadQueue();
  setInterval(loadQueue, 5000);
});
