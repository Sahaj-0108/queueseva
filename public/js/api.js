async function apiRequest(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = new Error(data.message || `Request failed with status ${response.status}`);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${url}:`, err);
    throw err;
  }
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Check session status and update nav login button
async function checkAuthNav() {
  const authContainer = document.getElementById('navAuthContainer');
  if (!authContainer) return;

  try {
    const res = await apiRequest('/api/auth/me');
    if (res && res.user) {
      const role = res.user.role;
      let dashLink = '/staff.html';
      if (role === 'doctor') dashLink = '/doctor.html';
      if (role === 'admin') dashLink = '/admin.html';

      authContainer.innerHTML = `
        <a href="${dashLink}" class="btn btn-outline btn-sm">
          👤 ${res.user.displayName || res.user.username} (${role.toUpperCase()})
        </a>
        <button id="logoutBtn" class="btn btn-secondary btn-sm" onclick="handleLogout()">Logout</button>
      `;
    }
  } catch (err) {
    // Not logged in
    authContainer.innerHTML = `<a href="/login.html" class="btn btn-primary btn-sm">Login</a>`;
  }
}

async function handleLogout() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 500);
  } catch (err) {
    window.location.href = '/login.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuthNav();
});
