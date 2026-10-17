# QueueSeva — Smart Government Hospital Management, Appointments, Queue & Healthcare Services

QueueSeva is a full-stack, cybersecurity-hardened healthcare and smart queue management platform designed for public and government hospitals.

---

## 🌟 Core Innovations Demonstrated

1. **Smart Appointment Recommendation System 🧠**
   - Instead of asking patients to guess exact slot availability, QueueSeva asks: *"When would you prefer to visit the hospital?"*
   - Analyzes doctor working hours, existing confirmed appointments, consultation duration (10 min avg), and queue load.
   - Computes an optimal **Arrival Window** (e.g. `12:15 PM – 12:25 PM`) and consultation slot.
   - Suggests nearest available alternative windows when preferred times are congested.

2. **Location-Aware Hospital Visit & Geofence 🗺️**
   - Browser Geolocation API checks proximity to the hospital.
   - At ~150-200m geofence radius, triggers automated arrival notification and prompts patient to confirm check-in.
   - Includes a **Simulate Hospital Arrival** button for hackathon judges.

3. **Interactive Hospital Indoor Navigation & Transit Guide 🚌**
   - Interactive SVG floor map marking: Main Entrance, OPD Rooms, Central Pathology Lab, Jan Aushadhi Pharmacy, Regional Blood Bank, Central Billing Counter, Lifts/Ramps, and Emergency Red Zone.
   - Dynamic path drawing to guide patients from entrance to consultation room.
   - Real-world transit connectivity (Metro station, AMTS bus stop, Prepaid auto stand, Parking).

4. **Public Counter Audio Announcements 📢**
   - Web Speech API voice synthesis in **English, Hindi (हिन्दी), and Gujarati (ગુજરાતી)**.
   - Example: *"Token OPD-012, please proceed to Doctor Consultation Room 3."*
   - Privacy-first: Announces token numbers rather than sensitive patient medical details.

5. **Cybersecurity & Role-Based Access Control (RBAC) 🔐**
   - 7 distinct role dashboards: **Patient, Doctor, Staff, Laboratory, Pharmacy, Blood Bank, Admin**.
   - Server-side authorization decorators on every endpoint.
   - Password hashing with `bcrypt`.
   - Tamper-resistant **Audit Log** and **Cybersecurity Event Monitor** (logs failed logins, privilege violation attempts, and emergency calls).

6. **Unified Hospital Service Flow**
   - Doctor writes digital prescriptions -> Orders automatically route to Pharmacy queue and Lab diagnostic queue.
   - Unified itemized digital bills with online pay simulation or cash counter receipts.

7. **Universal Accessibility & Multilingual Support**
   - Instant language switching between English, Hindi, and Gujarati.
   - **Accessibility Mode** with high contrast and enlarged fonts for senior citizens and low-vision patients.

---

## 🚀 How to Run QueueSeva

### 1. Requirements
- Python 3.10+
- Dependencies installed: `Flask`, `pymongo`, `bcrypt`

### 2. Start the Server
Open PowerShell / Terminal in `C:\Users\sahaj\.gemini\antigravity\scratch\queueseva`:
```powershell
python server.py
```

### 3. Open in Browser
Navigate to:
```
http://127.0.0.1:5000
```

---

## 👥 Demo Pre-Seeded Accounts

| Role | Email | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Patient** | `patient@queueseva.gov.in` | `patient123` | Book appointment, track token, view bills, check-in |
| **Doctor** | `doctor@queueseva.gov.in` | `doctor123` | Consult patients, write prescriptions, order lab tests |
| **Staff** | `staff@queueseva.gov.in` | `staff123` | Walk-in tokens, public voice announcements, pause queue |
| **Laboratory** | `lab@queueseva.gov.in` | `lab123` | Sample collection, test diagnostics, issue verified reports |
| **Pharmacy** | `pharmacy@queueseva.gov.in` | `pharmacy123` | Dispense prescribed medicines, inventory stock levels |
| **Blood Bank** | `bloodbank@queueseva.gov.in` | `blood123` | Units inventory (A+, B+, O-, etc.), fulfill requests |
| **Admin** | `admin@queueseva.gov.in` | `admin123` | Hospital metrics, audit trail, cybersecurity event monitor |

> **Quick Demo**: Click any of the role buttons in the top navigation ribbon (e.g. *👤 Patient*, *👨‍⚕️ Doctor*, *🧑‍💼 Staff*) to instantly switch accounts and explore that role's interface!

---

## 🗄️ Database Architecture (MongoDB + Auto-Fallback)

QueueSeva uses standard MongoDB collections:
- `users`: Credentials, roles, and profile information.
- `appointments`: Booking slots, arrival windows, status.
- `queues`: Live department counters, current token, pause state.
- `tokens`: Token sequence, service counter, priority.
- `prescriptions`: Digital prescriptions, medications, allergies.
- `labOrders`: Diagnostic requests, specimen status, reports.
- `medicines` & `pharmacyOrders`: Drug catalogue, stock levels, orders.
- `bloodInventory` & `bloodRequests`: Blood bank units and fulfillment.
- `bills`: Itemized hospital fees and receipt numbers.
- `auditLogs` & `securityEvents`: Cybersecurity and compliance trail.

*Zero Friction Setup*: If a local MongoDB instance (`mongodb://localhost:27017/queueseva`) is not active, QueueSeva automatically runs with an embedded persistent JSON storage engine (`data_store.json`), allowing instant full-fidelity testing without manual database configuration.
