let currentViewingToken = null;

async function checkDoctorAuth() {
  try {
    const res = await apiRequest('/api/auth/me');
    if (!res.user || res.user.role !== 'doctor') {
      window.location.href = '/unauthorized.html';
      return;
    }
    const header = document.getElementById('doctorProfileHeader');
    if (header) header.textContent = `${res.user.displayName || res.user.username} (Room 3)`;
  } catch (err) {
    window.location.href = '/login.html';
  }
}

async function loadAssignedPatients() {
  const tbody = document.getElementById('assignedPatientsBody');
  try {
    const res = await apiRequest('/api/doctor/patients');
    const patients = res.patients || [];

    if (patients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No patients assigned or waiting.</td></tr>';
      return;
    }

    tbody.innerHTML = patients.map(p => {
      const isServing = p.raw_status === 'CALLED';
      const badgeClass = isServing ? 'badge-service' : 'badge-waiting';

      return `
        <tr>
          <td><strong>${p.code}</strong></td>
          <td>${p.patient_name}</td>
          <td>${p.age}</td>
          <td>${p.dept_id}</td>
          <td>${p.complaint}</td>
          <td><span class="badge ${badgeClass}">${p.status}</span></td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="viewPatientDetails('${p.id}')">View</button>
          </td>
        </tr>
      `;
    }).join('');

    // If no patient is currently being viewed, view the first or currently in-service patient
    if (!currentViewingToken && patients.length > 0) {
      const active = patients.find(p => p.raw_status === 'CALLED') || patients[0];
      viewPatientDetails(active.id);
    }

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger);">${err.message}</td></tr>`;
  }
}

async function viewPatientDetails(tokenId) {
  try {
    const data = await apiRequest(`/api/doctor/patients/${tokenId}`);
    currentViewingToken = data.token;
    const pat = data.patient;

    document.getElementById('detailsCardHeader').textContent = `Patient Details (${data.token.code})`;
    document.getElementById('patName').textContent = pat.name;
    document.getElementById('patAgeGender').textContent = `${pat.age} / ${pat.gender === 'M' ? 'Male' : pat.gender === 'F' ? 'Female' : 'Other'}`;
    document.getElementById('patComplaint').textContent = pat.complaint + (pat.complaint_note ? ` - ${pat.complaint_note}` : '');

    const statusBadge = document.getElementById('patQueueStatus');
    statusBadge.textContent = data.token.status;
    statusBadge.className = 'badge ' + (data.token.status === 'In Service' ? 'badge-service' : 'badge-waiting');

    // Allergy Alert Box
    const allergyBox = document.getElementById('allergyAlertBox');
    const allergyText = document.getElementById('patAllergy');
    if (pat.allergies && pat.allergies.trim() && pat.allergies.toLowerCase() !== 'none') {
      allergyBox.style.display = 'flex';
      allergyText.textContent = pat.allergies;
    } else {
      allergyBox.style.display = 'none';
    }

    // Scroll to details card on small screens
    if (window.innerWidth < 768) {
      document.getElementById('activePatientCard').scrollIntoView({ behavior: 'smooth' });
    }

  } catch (err) {
    showToast(err.message || 'Failed to load patient details', 'error');
  }
}

async function completeConsultation() {
  if (!currentViewingToken) {
    showToast('No active patient selected', 'warning');
    return;
  }

  const btn = document.getElementById('markCompletedBtn');
  btn.disabled = true;

  try {
    const res = await apiRequest(`/api/doctor/patients/${currentViewingToken.id}/complete`, {
      method: 'POST'
    });
    showToast(res.message, 'success');
    currentViewingToken = null;
    loadAssignedPatients();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function referPatient(targetDept) {
  if (!currentViewingToken) {
    showToast('No active patient selected', 'warning');
    return;
  }

  try {
    const res = await apiRequest(`/api/doctor/patients/${currentViewingToken.id}/refer`, {
      method: 'POST',
      body: JSON.stringify({ target_dept: targetDept })
    });
    showToast(res.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkDoctorAuth();
  loadAssignedPatients();
  setInterval(loadAssignedPatients, 5000);
});
