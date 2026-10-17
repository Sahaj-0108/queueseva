const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./db');

async function seed() {
  await initDatabase();
  console.log('[Seed] Seeding demo database for QueueSeva with expanded dummy patients...');

  // Clear existing collections
  await db.users.deleteMany({});
  await db.departments.deleteMany({});
  await db.doctors.deleteMany({});
  await db.schedules.deleteMany({});
  await db.patients.deleteMany({});
  await db.appointments.deleteMany({});
  await db.tokens.deleteMany({});
  await db.audit_log.deleteMany({});
  await db.security_events.deleteMany({});

  const now = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Seed Users (Demo Accounts)
  const staffHash = await bcrypt.hash('Staff@123', 10);
  const doctorHash = await bcrypt.hash('Doctor@123', 10);
  const adminHash = await bcrypt.hash('Admin@123', 10);

  await db.users.insertMany([
    {
      id: 1,
      username: 'staff1',
      password_hash: staffHash,
      role: 'staff',
      display_name: 'Hospital Staff Member',
      doctor_id: null
    },
    {
      id: 2,
      username: 'dr.mehta',
      password_hash: doctorHash,
      role: 'doctor',
      display_name: 'Dr. A. Mehta',
      doctor_id: 1
    },
    {
      id: 3,
      username: 'dr.shah',
      password_hash: doctorHash,
      role: 'doctor',
      display_name: 'Dr. R. Shah',
      doctor_id: 2
    },
    {
      id: 4,
      username: 'admin',
      password_hash: adminHash,
      role: 'admin',
      display_name: 'Hospital Administrator',
      doctor_id: null
    }
  ]);

  // 2. Seed Departments
  await db.departments.insertMany([
    {
      id: 'OPD',
      name_en: 'OPD Consultation',
      name_gu: 'ઓપીડી પરામર્શ',
      name_hi: 'ओपीडी परामर्श',
      is_paused: 0,
      pause_message: ''
    },
    {
      id: 'LAB',
      name_en: 'Laboratory',
      name_gu: 'પ્રયોગશાળા',
      name_hi: 'प्रयोगशाला',
      is_paused: 0,
      pause_message: ''
    },
    {
      id: 'PHR',
      name_en: 'Pharmacy',
      name_gu: 'ફાર્મસી (દવા વિતરણ)',
      name_hi: 'ફાર્મેસી (दवा वितरण)',
      is_paused: 0,
      pause_message: ''
    }
  ]);

  // 3. Seed Doctors
  await db.doctors.insertMany([
    {
      id: 1,
      name: 'Dr. A. Mehta (General Physician)',
      dept_id: 'OPD',
      room: 'Room 3',
      specialization: 'General Medicine'
    },
    {
      id: 2,
      name: 'Dr. R. Shah (Senior Physician)',
      dept_id: 'OPD',
      room: 'Room 4',
      specialization: 'Internal Medicine'
    },
    {
      id: 3,
      name: 'Dr. K. Patel (Pathologist)',
      dept_id: 'LAB',
      room: 'Room 101',
      specialization: 'Pathology'
    }
  ]);

  // 4. Seed Schedules
  const schedules = [];
  for (let docId of [1, 2, 3]) {
    for (let weekday = 0; weekday <= 6; weekday++) {
      schedules.push({
        doctor_id: docId,
        weekday,
        start_time: '09:00',
        end_time: '17:00',
        slot_minutes: 15
      });
    }
  }
  await db.schedules.insertMany(schedules);

  // 5. Seed 30+ Realistic Dummy Patients with Diverse Backgrounds
  const dummyPatients = [
    { name: 'Ramesh Patel', age: 45, gender: 'M', phone: '9876543210', complaint: 'Fever & cough', allergies: 'None' },
    { name: 'Neha Shah', age: 32, gender: 'F', phone: '9876543211', complaint: 'Headache', allergies: 'None' },
    { name: 'Amit Yadav', age: 29, gender: 'M', phone: '9876543212', complaint: 'Joint pain', allergies: 'None' },
    { name: 'Pooja Mehta', age: 38, gender: 'F', phone: '9876543213', complaint: 'Blood Pressure', allergies: 'None' },
    { name: 'Suresh Kumar', age: 52, gender: 'M', phone: '9876543214', complaint: 'Back pain', allergies: 'None' },
    { name: 'Kavita Joshi', age: 28, gender: 'F', phone: '9876543215', complaint: 'Stomach pain', allergies: 'None' },
    { name: 'Rahul Sharma', age: 28, gender: 'M', phone: '9876543216', complaint: 'Fever and cough', allergies: 'Penicillin (mild)' },
    { name: 'Anjali Verma', age: 67, gender: 'F', phone: '9876543217', complaint: 'Diabetes', allergies: 'Sulfa drugs' },
    { name: 'Vijay Choksi', age: 41, gender: 'M', phone: '9876543218', complaint: 'Skin rash', allergies: 'None' },
    { name: 'Sunita Devi', age: 72, gender: 'F', phone: '9876543219', complaint: 'Joint pain', allergies: 'Aspirin' },
    { name: 'Vikram Singh', age: 35, gender: 'M', phone: '9876543220', complaint: 'Headache', allergies: 'None' },
    { name: 'Priya Nair', age: 26, gender: 'F', phone: '9876543221', complaint: 'General Check-up', allergies: 'None' },
    { name: 'Mohammad Ansari', age: 58, gender: 'M', phone: '9876543222', complaint: 'Blood Pressure', allergies: 'Beta-blockers' },
    { name: 'Geeta Ben', age: 63, gender: 'F', phone: '9876543223', complaint: 'Back pain', allergies: 'None' },
    { name: 'Harsh Vardhan', age: 21, gender: 'M', phone: '9876543224', complaint: 'Cough/Cold', allergies: 'None' },
    { name: 'Manish Trivedi', age: 48, gender: 'M', phone: '9876543225', complaint: 'Stomach', allergies: 'None' },
    { name: 'Deepa Roy', age: 31, gender: 'F', phone: '9876543226', complaint: 'Fever', allergies: 'None' },
    { name: 'Kishore Parmar', age: 69, gender: 'M', phone: '9876543227', complaint: 'Diabetes', allergies: 'Ibuprofen' },
    { name: 'Meena Rathod', age: 27, gender: 'F', phone: '9876543228', complaint: 'General Check-up', allergies: 'None' },
    { name: 'Chetan Doshi', age: 54, gender: 'M', phone: '9876543229', complaint: 'Skin', allergies: 'Dust & Pollen' },
    { name: 'Bhavna Vaghela', age: 36, gender: 'F', phone: '9876543230', complaint: 'Blood Pressure', allergies: 'None' },
    { name: 'Dharmesh Solanki', age: 43, gender: 'M', phone: '9876543231', complaint: 'Joint pain', allergies: 'None' },
    { name: 'Rekha Choudhary', age: 50, gender: 'F', phone: '9876543232', complaint: 'Diabetes', allergies: 'None' },
    { name: 'Alok Mishra', age: 39, gender: 'M', phone: '9876543233', complaint: 'Cough/Cold', allergies: 'None' },
    { name: 'Farhana Sheikh', age: 29, gender: 'F', phone: '9876543234', complaint: 'Headache', allergies: 'None' },
    { name: 'Gopal Krishnan', age: 61, gender: 'M', phone: '9876543235', complaint: 'Back pain', allergies: 'Paracetamol' },
    { name: 'Swati Kulkarni', age: 34, gender: 'F', phone: '9876543236', complaint: 'Stomach', allergies: 'None' },
    { name: 'Naresh Bhai', age: 75, gender: 'M', phone: '9876543237', complaint: 'Fever', allergies: 'None' },
    { name: 'Urmila Ben', age: 66, gender: 'F', phone: '9876543238', complaint: 'Joint pain', allergies: 'None' },
    { name: 'Arunav Sengupta', age: 42, gender: 'M', phone: '9876543239', complaint: 'Blood Pressure', allergies: 'None' }
  ];

  const insertedPatients = [];
  for (let i = 0; i < dummyPatients.length; i++) {
    const p = dummyPatients[i];
    const inserted = await db.patients.insertOne({
      ...p,
      created_at: now - (dummyPatients.length - i) * 600000
    });
    insertedPatients.push(inserted);
  }

  // 6. Seed OPD Active Queue
  const defaultAccessHash = await bcrypt.hash('1234', 10);

  // 17 Historical Served Tokens (for statistical average wait calculation)
  for (let i = 1; i <= 17; i++) {
    const code = `OPD-${String(i).padStart(3, '0')}`;
    const tokenTime = now - (18 - i) * 600000;
    await db.tokens.insertOne({
      code,
      dept_id: 'OPD',
      day: todayStr,
      patient_id: insertedPatients[i % insertedPatients.length]._id,
      doctor_id: (i % 2 === 0) ? 2 : 1, // Split across Dr. Mehta and Dr. Shah
      appointment_id: null,
      access_code_hash: defaultAccessHash,
      status: 'SERVED',
      sort_key: tokenTime,
      moved_up_at: null,
      created_at: tokenTime,
      called_at: tokenTime + 180000,
      served_at: tokenTime + 540000
    });
  }

  // Currently In Service Token: OPD-018 (Dr. Mehta, Room 3)
  await db.tokens.insertOne({
    code: 'OPD-018',
    dept_id: 'OPD',
    day: todayStr,
    patient_id: insertedPatients[0]._id, // Ramesh Patel
    doctor_id: 1,
    appointment_id: null,
    access_code_hash: defaultAccessHash,
    status: 'CALLED',
    sort_key: now - 900000,
    moved_up_at: null,
    created_at: now - 900000,
    called_at: now - 120000,
    served_at: null
  });

  // Active Waiting Tokens (OPD-019 through OPD-030)
  const waitingTokensData = [
    { code: 'OPD-019', patIdx: 1, docId: 1, urgent: null }, // Neha Shah
    { code: 'OPD-020', patIdx: 2, docId: 2, urgent: null }, // Amit Yadav (Dr. Shah)
    { code: 'OPD-021', patIdx: 3, docId: 1, urgent: null }, // Pooja Mehta
    { code: 'OPD-022', patIdx: 4, docId: 2, urgent: null }, // Suresh Kumar (Dr. Shah)
    { code: 'OPD-023', patIdx: 5, docId: 1, urgent: null }, // Kavita Joshi
    { code: 'OPD-024', patIdx: 6, docId: 1, urgent: null }, // Rahul Sharma (Penicillin allergy)
    { code: 'OPD-025', patIdx: 7, docId: 2, urgent: 'Senior citizen' }, // Anjali Verma (Senior Citizen)
    { code: 'OPD-026', patIdx: 8, docId: 1, urgent: null }, // Vijay Choksi
    { code: 'OPD-027', patIdx: 9, docId: 2, urgent: 'Senior citizen' }, // Sunita Devi (72y, Senior Citizen)
    { code: 'OPD-028', patIdx: 10, docId: 1, urgent: null }, // Vikram Singh
    { code: 'OPD-029', patIdx: 11, docId: 2, urgent: 'Pregnant' }, // Priya Nair (Pregnant priority)
    { code: 'OPD-030', patIdx: 12, docId: 1, urgent: null }  // Mohammad Ansari
  ];

  for (let idx = 0; idx < waitingTokensData.length; idx++) {
    const item = waitingTokensData[idx];
    const pat = insertedPatients[item.patIdx];
    await db.tokens.insertOne({
      code: item.code,
      dept_id: 'OPD',
      day: todayStr,
      patient_id: pat._id,
      doctor_id: item.docId,
      appointment_id: null,
      access_code_hash: defaultAccessHash,
      status: 'WAITING',
      sort_key: now + idx * 60000,
      moved_up_at: item.urgent ? (now - 300000 + idx * 1000) : null,
      urgent_reason: item.urgent || null,
      created_at: now - (15 - idx) * 60000,
      called_at: null,
      served_at: null
    });
  }

  // 7. Seed Laboratory Tokens (LAB-005 to LAB-012)
  await db.tokens.insertOne({
    code: 'LAB-005',
    dept_id: 'LAB',
    day: todayStr,
    patient_id: insertedPatients[13]._id, // Geeta Ben
    doctor_id: 3,
    appointment_id: null,
    access_code_hash: defaultAccessHash,
    status: 'CALLED',
    sort_key: now - 600000,
    moved_up_at: null,
    created_at: now - 600000,
    called_at: now - 60000,
    served_at: null
  });

  for (let i = 6; i <= 12; i++) {
    await db.tokens.insertOne({
      code: `LAB-${String(i).padStart(3, '0')}`,
      dept_id: 'LAB',
      day: todayStr,
      patient_id: insertedPatients[(10 + i) % insertedPatients.length]._id,
      doctor_id: 3,
      appointment_id: null,
      access_code_hash: defaultAccessHash,
      status: 'WAITING',
      sort_key: now + i * 60000,
      moved_up_at: null,
      created_at: now - (14 - i) * 60000,
      called_at: null,
      served_at: null
    });
  }

  // 8. Seed Pharmacy Tokens (PH-010 to PH-016)
  await db.tokens.insertOne({
    code: 'PH-010',
    dept_id: 'PHR',
    day: todayStr,
    patient_id: insertedPatients[18]._id, // Meena Rathod
    doctor_id: null,
    appointment_id: null,
    access_code_hash: defaultAccessHash,
    status: 'CALLED',
    sort_key: now - 500000,
    moved_up_at: null,
    created_at: now - 500000,
    called_at: now - 45000,
    served_at: null
  });

  for (let i = 11; i <= 16; i++) {
    await db.tokens.insertOne({
      code: `PH-${String(i).padStart(3, '0')}`,
      dept_id: 'PHR',
      day: todayStr,
      patient_id: insertedPatients[(15 + i) % insertedPatients.length]._id,
      doctor_id: null,
      appointment_id: null,
      access_code_hash: defaultAccessHash,
      status: 'WAITING',
      sort_key: now + i * 60000,
      moved_up_at: null,
      created_at: now - (18 - i) * 60000,
      called_at: null,
      served_at: null
    });
  }

  // 9. Seed 8+ Realistic Booked Appointments Across the Day
  const cancelHash = await bcrypt.hash('1234', 10);
  const sampleAppointments = [
    {
      id: 'APT-7K3Q9',
      patient_id: insertedPatients[6]._id, // Rahul Sharma
      doctor_id: 1,
      dept_id: 'OPD',
      slot_start: now + 3600000,
      status: 'BOOKED'
    },
    {
      id: 'APT-9B2F4',
      patient_id: insertedPatients[7]._id, // Anjali Verma
      doctor_id: 1,
      dept_id: 'OPD',
      slot_start: now + 5400000,
      status: 'BOOKED'
    },
    {
      id: 'APT-2C4X8',
      patient_id: insertedPatients[14]._id, // Harsh Vardhan
      doctor_id: 2,
      dept_id: 'OPD',
      slot_start: now + 7200000,
      status: 'BOOKED'
    },
    {
      id: 'APT-8M1N5',
      patient_id: insertedPatients[19]._id, // Chetan Doshi
      doctor_id: 1,
      dept_id: 'OPD',
      slot_start: now + 9000000,
      status: 'BOOKED'
    },
    {
      id: 'APT-3H7K2',
      patient_id: insertedPatients[20]._id, // Bhavna Vaghela
      doctor_id: 2,
      dept_id: 'OPD',
      slot_start: now - 3600000,
      status: 'CHECKED_IN'
    },
    {
      id: 'APT-5P9Q1',
      patient_id: insertedPatients[21]._id, // Dharmesh Solanki
      doctor_id: 1,
      dept_id: 'OPD',
      slot_start: now - 7200000,
      status: 'COMPLETED'
    },
    {
      id: 'APT-4W8Y6',
      patient_id: insertedPatients[22]._id, // Rekha Choudhary
      doctor_id: 2,
      dept_id: 'OPD',
      slot_start: now - 9000000,
      status: 'COMPLETED'
    },
    {
      id: 'APT-6T2R3',
      patient_id: insertedPatients[23]._id, // Alok Mishra
      doctor_id: 1,
      dept_id: 'OPD',
      slot_start: now - 1800000,
      status: 'CANCELLED'
    }
  ];

  for (const a of sampleAppointments) {
    await db.appointments.insertOne({
      ...a,
      cancel_code_hash: cancelHash,
      consent_at: now - 3600000,
      created_at: now - 3600000
    });
  }

  // 10. Audit log entries
  await db.audit_log.insertOne({
    time: now - 1800000,
    user_id: 1,
    username: 'staff1',
    role: 'staff',
    action: 'SYSTEM_INITIALIZED',
    target: 'ALL',
    detail: 'Demo database seeded with 30 synthetic patients, active department queues, and booked appointments.',
    ip: '127.0.0.1'
  });

  console.log('[Seed] Seeding completed with 30 dummy patients across all departments!');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('[Seed Error]', err);
    process.exit(1);
  });
}

module.exports = { seed };
