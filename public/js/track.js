let currentTokenCode = '';
let currentAccessCode = '';
let pollInterval = null;

function initParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const access = urlParams.get('access');

  if (code) {
    currentTokenCode = code.toUpperCase();
    currentAccessCode = access || '';
    document.getElementById('tokenInput').value = currentTokenCode;
    if (access) document.getElementById('accessCodeInput').value = access;
    fetchTokenStatus();
  } else {
    // Default to seeded demo token OPD-024 for quick testing
    currentTokenCode = 'OPD-024';
    currentAccessCode = '1234';
    document.getElementById('tokenInput').value = 'OPD-024';
    document.getElementById('accessCodeInput').value = '1234';
    fetchTokenStatus();
  }
}

function handleSearchToken(event) {
  event.preventDefault();
  const code = document.getElementById('tokenInput').value.trim().toUpperCase();
  const access = document.getElementById('accessCodeInput').value.trim();

  if (!code) {
    showToast('Please enter a token number', 'warning');
    return;
  }

  currentTokenCode = code;
  currentAccessCode = access;

  // Update URL history without reload
  const newUrl = `${window.location.pathname}?code=${encodeURIComponent(code)}${access ? '&access=' + encodeURIComponent(access) : ''}`;
  window.history.replaceState({}, '', newUrl);

  fetchTokenStatus();
}

async function fetchTokenStatus() {
  if (!currentTokenCode) return;

  try {
    let url = `/api/tokens/status?code=${encodeURIComponent(currentTokenCode)}`;
    if (currentAccessCode) {
      url += `&access=${encodeURIComponent(currentAccessCode)}`;
    }

    const data = await apiRequest(url);

    // Update Left Card
    document.getElementById('liveTokenNum').textContent = data.token_number;
    document.getElementById('liveDept').textContent = data.department;

    const badge = document.getElementById('liveStatusBadge');
    badge.textContent = data.status;
    badge.className = 'badge ' + (data.status === 'In Service' ? 'badge-service' : data.status === 'Waiting' ? 'badge-waiting' : 'badge-served');

    document.getElementById('livePosition').textContent = data.position_in_queue;
    document.getElementById('liveWaitTime').textContent = data.estimated_wait_time;

    // Handle Paused state notice
    const pauseBox = document.getElementById('pauseNotice');
    if (data.is_paused) {
      pauseBox.style.display = 'block';
      document.getElementById('pauseNoticeMsg').textContent = data.pause_message || 'Queue is currently paused.';
    } else {
      pauseBox.style.display = 'none';
    }

    // Update Right Card
    document.getElementById('progressHeaderTitle').textContent = `Queue Progress (${data.department})`;
    document.getElementById('liveCurrentlyServing').textContent = data.queue_progress.currently_serving || 'None';

    const nextContainer = document.getElementById('liveNextTokens');
    if (data.queue_progress.next_tokens && data.queue_progress.next_tokens.length > 0) {
      nextContainer.innerHTML = data.queue_progress.next_tokens.map(tok => 
        `<span class="next-token-chip">${tok}</span>`
      ).join('');
    } else {
      nextContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">No tokens waiting</span>';
    }

    document.getElementById('liveTotalWaiting').textContent = `${data.queue_progress.total_waiting} patients`;

  } catch (err) {
    if (err.status === 403) {
      showToast('Access code required or invalid for private token details.', 'error');
    } else {
      showToast(err.message || 'Token not found.', 'error');
    }
  }
}

// Start auto-poll every 5 seconds
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(fetchTokenStatus, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  initParams();
  startPolling();
});

window.addEventListener('beforeunload', () => {
  if (pollInterval) clearInterval(pollInterval);
});
