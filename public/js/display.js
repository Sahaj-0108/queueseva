function updateClock() {
  const clock = document.getElementById('liveDisplayClock');
  if (!clock) return;
  const now = new Date();
  const options = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  clock.textContent = now.toLocaleDateString('en-US', options).replace(',', ' |');
}

async function fetchDisplayData() {
  try {
    const res = await apiRequest('/api/departments');
    const departments = res.departments || [];

    departments.forEach(dept => {
      const id = dept.id.toLowerCase();
      const servingEl = document.getElementById(`${id}Serving`);
      const nextEl = document.getElementById(`${id}Next`);
      const waitEl = document.getElementById(`${id}Wait`);
      const statusEl = document.getElementById(`${id}Status`);

      if (servingEl) servingEl.textContent = dept.currently_serving || '---';

      if (nextEl) {
        if (dept.next_tokens && dept.next_tokens.length > 0) {
          nextEl.innerHTML = dept.next_tokens.map(t => `<span class="next-token-chip">${t}</span>`).join('');
        } else {
          nextEl.innerHTML = '<span style="color: #64748b; font-size: 0.9rem;">No tokens waiting</span>';
        }
      }

      if (waitEl) waitEl.textContent = dept.estimated_wait;

      if (statusEl) {
        if (dept.is_paused) {
          statusEl.textContent = `Paused: ${dept.pause_message || ''}`;
          statusEl.className = 'badge badge-urgent';
        } else {
          statusEl.textContent = 'Normal';
          statusEl.className = 'badge badge-service';
        }
      }
    });
  } catch (err) {
    console.error('Failed to load display data:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);

  fetchDisplayData();
  setInterval(fetchDisplayData, 5000);
});
