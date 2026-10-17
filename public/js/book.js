let selectedDoctor = null;
let selectedSlot = null;
let doctorsList = [];

// Initialize today and tomorrow's date
function initDatePicker() {
  const dateInput = document.getElementById('dateInput');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  dateInput.min = todayStr;
  dateInput.value = todayStr;
  updateSummaryDate(todayStr);

  dateInput.addEventListener('change', () => {
    updateSummaryDate(dateInput.value);
    loadSlots();
  });
}

function updateSummaryDate(val) {
  const sumDate = document.getElementById('sumDate');
  if (sumDate) sumDate.textContent = val;
}

// Load doctors based on selected department
async function loadDoctors() {
  const dept = document.getElementById('deptSelect').value;
  const docSelect = document.getElementById('doctorSelect');
  docSelect.innerHTML = '<option value="">Loading doctors...</option>';

  try {
    const res = await apiRequest(`/api/doctors?dept=${dept}`);
    doctorsList = res.doctors || [];

    if (doctorsList.length === 0) {
      docSelect.innerHTML = '<option value="">No doctors available for this department</option>';
      document.getElementById('slotsGrid').innerHTML = '<div style="color: var(--text-muted);">No slots available.</div>';
      return;
    }

    docSelect.innerHTML = doctorsList.map((d, index) => 
      `<option value="${d.id}" ${index === 0 ? 'selected' : ''}>${d.name} (${d.room || 'General'})</option>`
    ).join('');

    selectedDoctor = doctorsList[0];
    updateSummaryDoctor();
    loadSlots();
  } catch (err) {
    showToast('Failed to load doctors: ' + err.message, 'error');
  }
}

function updateSummaryDoctor() {
  const sumDoc = document.getElementById('sumDoctor');
  const sumDept = document.getElementById('sumDept');
  const deptSelect = document.getElementById('deptSelect');

  if (sumDept) sumDept.textContent = deptSelect.value;
  if (sumDoc && selectedDoctor) sumDoc.textContent = selectedDoctor.name;
}

// Load dynamic slots
async function loadSlots() {
  const docId = document.getElementById('doctorSelect').value;
  const dateStr = document.getElementById('dateInput').value;
  const grid = document.getElementById('slotsGrid');

  if (!docId || !dateStr) {
    grid.innerHTML = '<div style="color: var(--text-muted);">Please select a doctor and date.</div>';
    return;
  }

  grid.innerHTML = '<div style="color: var(--text-muted);">Fetching available slots...</div>';
  selectedSlot = null;
  document.getElementById('sumTime').textContent = '--:--';

  try {
    const res = await apiRequest(`/api/doctors/${docId}/slots?date=${dateStr}`);
    const slots = res.slots || [];

    if (slots.length === 0) {
      grid.innerHTML = '<div style="color: var(--text-muted);">No schedule or slots available for this date.</div>';
      return;
    }

    grid.innerHTML = '';
    slots.forEach((s) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `slot-btn ${s.available ? '' : 'disabled'}`;
      btn.textContent = s.time;
      btn.disabled = !s.available;

      if (s.available) {
        btn.onclick = () => selectSlot(s, btn);
      }
      grid.appendChild(btn);
    });

    // Auto-select first available slot if any
    const firstAvail = slots.find(s => s.available);
    if (firstAvail) {
      const firstBtn = Array.from(grid.children).find(b => !b.disabled);
      if (firstBtn) selectSlot(firstAvail, firstBtn);
    }
  } catch (err) {
    grid.innerHTML = `<div style="color: var(--danger); font-size: 0.9rem;">${err.message}</div>`;
  }
}

function selectSlot(slot, btnElement) {
  selectedSlot = slot;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  btnElement.classList.add('selected');
  document.getElementById('sumTime').textContent = slot.time;
}

// Navigation between Wizard Steps
function goToStep(stepNum) {
  if (stepNum === 4) {
    if (!selectedDoctor) {
      showToast('Please select a doctor first.', 'warning');
      return;
    }
    if (!selectedSlot) {
      showToast('Please select an available time slot.', 'warning');
      return;
    }

    document.getElementById('stepPanel1').style.display = 'none';
    document.getElementById('stepPanel2').style.display = 'block';
    document.getElementById('stepPanel3').style.display = 'none';
    document.getElementById('summaryActionContainer').style.display = 'none';

    document.getElementById('stepIndicator1').className = 'wizard-step completed';
    document.getElementById('stepIndicator2').className = 'wizard-step completed';
    document.getElementById('stepIndicator3').className = 'wizard-step completed';
    document.getElementById('stepIndicator4').className = 'wizard-step active';
  } else if (stepNum === 1) {
    document.getElementById('stepPanel1').style.display = 'block';
    document.getElementById('stepPanel2').style.display = 'none';
    document.getElementById('stepPanel3').style.display = 'none';
    document.getElementById('summaryActionContainer').style.display = 'block';

    document.getElementById('stepIndicator1').className = 'wizard-step active';
    document.getElementById('stepIndicator2').className = 'wizard-step';
    document.getElementById('stepIndicator3').className = 'wizard-step';
    document.getElementById('stepIndicator4').className = 'wizard-step';
  }
}

// Submit Appointment Booking
async function submitBooking() {
  const name = document.getElementById('patientName').value.trim();
  const age = parseInt(document.getElementById('patientAge').value, 10);
  const gender = document.getElementById('patientGender').value;
  const phone = document.getElementById('patientPhone').value.trim();
  const complaint = document.getElementById('patientComplaint').value;
  const allergies = document.getElementById('patientAllergies').value.trim();
  const consent = document.getElementById('consentCheckbox').checked;

  if (!name || name.length < 2) {
    showToast('Please enter patient name (minimum 2 characters)', 'warning');
    return;
  }
  if (isNaN(age) || age < 0 || age > 120) {
    showToast('Please enter a valid age between 0 and 120', 'warning');
    return;
  }
  if (!phone || !/^[0-9]{10}$/.test(phone)) {
    showToast('Please enter a valid 10-digit phone number', 'warning');
    return;
  }
  if (!consent) {
    showToast('You must check the consent box to proceed', 'warning');
    return;
  }

  const deptId = document.getElementById('deptSelect').value;
  const submitBtn = document.getElementById('submitBookingBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing booking...';

  try {
    const payload = {
      dept_id: deptId,
      doctor_id: Number(selectedDoctor.id),
      slot_start: selectedSlot.slot_start,
      name,
      age,
      gender,
      phone,
      complaint,
      allergies,
      consent: true
    };

    const res = await apiRequest('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showToast('Appointment booked successfully!', 'success');

    // Show Step 5 Confirmation
    document.getElementById('stepPanel1').style.display = 'none';
    document.getElementById('stepPanel2').style.display = 'none';
    document.getElementById('stepPanel3').style.display = 'block';
    document.getElementById('summaryCard').style.display = 'none';

    document.querySelectorAll('.wizard-step').forEach(s => s.className = 'wizard-step completed');
    document.getElementById('stepIndicator5').className = 'wizard-step active';

    // Populate confirmation details
    const apt = res.appointment;
    document.getElementById('confirmedAptId').textContent = apt.id;
    document.getElementById('confDept').textContent = apt.department;
    document.getElementById('confDoctor').textContent = apt.doctor_name;
    document.getElementById('confDate').textContent = apt.date_formatted;
    document.getElementById('confTime').textContent = apt.slot_formatted;
    document.getElementById('confPatient').textContent = `${apt.patient_name} (${apt.patient_age}y, ${apt.patient_gender})`;
    document.getElementById('confCancelCode').textContent = apt.cancellation_code;

  } catch (err) {
    showToast(err.message || 'Failed to book appointment', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirm & Book Appointment';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initDatePicker();

  document.getElementById('deptSelect').addEventListener('change', () => {
    updateSummaryDoctor();
    loadDoctors();
  });

  document.getElementById('doctorSelect').addEventListener('change', (e) => {
    const docId = Number(e.target.value);
    selectedDoctor = doctorsList.find(d => d.id === docId) || null;
    updateSummaryDoctor();
    loadSlots();
  });

  loadDoctors();
});
