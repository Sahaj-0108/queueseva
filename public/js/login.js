let currentSelectedRole = 'staff';

function selectRole(role, pillElement) {
  document.querySelectorAll('.role-pill').forEach(p => p.classList.remove('active'));
  pillElement.classList.add('active');
  currentSelectedRole = role;
}

function fillDemo(username, password, role) {
  document.getElementById('usernameInput').value = username;
  document.getElementById('passwordInput').value = password;

  const rolePill = Array.from(document.querySelectorAll('.role-pill')).find(p => 
    p.textContent.trim().toLowerCase() === role.toLowerCase()
  );
  if (rolePill) selectRole(role, rolePill);
}

// Instant One-Click Login for any account
async function quickOneClickLogin(username, password, role) {
  fillDemo(username, password, role);

  const errorBox = document.getElementById('loginErrorBox');
  const loginBtn = document.getElementById('loginBtn');
  errorBox.style.display = 'none';

  loginBtn.disabled = true;
  loginBtn.textContent = `Signing in as ${username}...`;

  try {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    showToast(`✓ Logged in as ${res.user.displayName || username}! Redirecting...`, 'success');

    setTimeout(() => {
      if (role === 'doctor') {
        window.location.href = '/doctor.html';
      } else if (role === 'admin') {
        window.location.href = '/admin.html';
      } else {
        window.location.href = '/staff.html';
      }
    }, 400);

  } catch (err) {
    errorBox.style.display = 'block';
    if (err.status === 429) {
      errorBox.innerHTML = `<strong>⚠️ Rate Limit Exceeded:</strong> Too many attempts. Login is temporarily locked for 15 minutes.`;
    } else {
      errorBox.innerHTML = `<strong>⚠️ Authentication Failed:</strong> ${err.message || 'Invalid username or password.'}`;
    }
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

function togglePasswordVisibility() {
  const pwd = document.getElementById('passwordInput');
  pwd.type = pwd.type === 'password' ? 'text' : 'password';
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const errorBox = document.getElementById('loginErrorBox');
  const loginBtn = document.getElementById('loginBtn');

  errorBox.style.display = 'none';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Verifying credentials...';

  try {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    showToast(`✓ Login successful! Redirecting...`, 'success');

    const role = res.user.role;
    setTimeout(() => {
      if (role === 'doctor') {
        window.location.href = '/doctor.html';
      } else if (role === 'admin') {
        window.location.href = '/admin.html';
      } else {
        window.location.href = '/staff.html';
      }
    }, 400);

  } catch (err) {
    errorBox.style.display = 'block';
    if (err.status === 429) {
      errorBox.innerHTML = `<strong>⚠️ Rate Limit Exceeded:</strong> Too many failed attempts. Login is temporarily locked for 15 minutes.`;
    } else {
      errorBox.innerHTML = `<strong>⚠️ Authentication Failed:</strong> ${err.message || 'Invalid username or password.'}`;
    }
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

// Default pre-fill for convenience
document.addEventListener('DOMContentLoaded', () => {
  fillDemo('staff1', 'Staff@123', 'staff');
});
