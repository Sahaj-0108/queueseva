async function handleGenerateToken(event) {
  event.preventDefault();

  const name = document.getElementById('walkinName').value.trim();
  const age = parseInt(document.getElementById('walkinAge').value, 10);
  const gender = document.getElementById('walkinGender').value;
  const dept_id = document.getElementById('walkinDept').value;
  const complaint = document.getElementById('walkinComplaint').value;
  const allergies = document.getElementById('walkinAllergies').value.trim();

  if (!name) {
    showToast('Please enter patient name', 'warning');
    return;
  }
  if (isNaN(age) || age < 0 || age > 120) {
    showToast('Please enter a valid age between 0 and 120', 'warning');
    return;
  }

  const btn = document.getElementById('genTokenBtn');
  btn.disabled = true;
  btn.textContent = 'Generating token...';

  try {
    const res = await apiRequest('/api/tokens/walk-in', {
      method: 'POST',
      body: JSON.stringify({
        dept_id,
        name,
        age,
        gender,
        complaint,
        allergies
      })
    });

    const token = res.token;
    showToast('Token generated successfully!', 'success');

    // Display Result Card
    document.getElementById('tokenCardPlaceholder').style.display = 'none';
    const resultCard = document.getElementById('tokenGeneratedCard');
    resultCard.style.display = 'block';

    document.getElementById('resTokenCode').textContent = token.code;
    document.getElementById('resDept').textContent = token.department;
    document.getElementById('resPosition').textContent = token.position;
    document.getElementById('resWaitTime').textContent = token.estimated_wait;
    document.getElementById('resAccessCode').textContent = token.access_code;

    // Set link to track status
    const trackBtn = document.getElementById('viewQueueStatusBtn');
    trackBtn.href = `/track.html?code=${encodeURIComponent(token.code)}&access=${encodeURIComponent(token.access_code)}`;

  } catch (err) {
    showToast(err.message || 'Failed to generate token', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Token';
  }
}
