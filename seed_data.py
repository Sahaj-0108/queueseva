"""
Database Seeder for QueueSeva
Seeds initial departments, doctors, test catalogue, medicine inventory,
blood bank units, hospital navigation markers, transit stops, and role accounts.
"""

from db import get_collection
from security import hash_password

def seed_database():
    users_col = get_collection("users")
    depts_col = get_collection("departments")
    doctors_col = get_collection("doctors")
    tests_col = get_collection("labTests")
    medicines_col = get_collection("medicines")
    blood_col = get_collection("bloodInventory")
    locations_col = get_collection("hospitalLocations")
    transport_col = get_collection("transportLocations")
    queues_col = get_collection("queues")
    tokens_col = get_collection("tokens")
    appointments_col = get_collection("appointments")
    bills_col = get_collection("bills")

    # 1. Seed Roles & Accounts
    default_users = [
        {
            "_id": "usr_patient_1",
            "name": "Ramesh Patel",
            "email": "patient@queueseva.gov.in",
            "phone": "+91 98765 43210",
            "age": 58,
            "gender": "Male",
            "role": "patient",
            "emergencyContact": "Kavita Patel (+91 98765 43211)",
            "allergies": ["Penicillin", "Sulfa drugs"],
            "passwordHash": hash_password("patient123"),
            "sessionToken": None
        },
        {
            "_id": "usr_doctor_1",
            "name": "Dr. Aarav Mehta (MD, Medicine)",
            "email": "doctor@queueseva.gov.in",
            "phone": "+91 98250 11223",
            "role": "doctor",
            "departmentId": "dept_gen_med",
            "roomNumber": "OPD Room 3",
            "passwordHash": hash_password("doctor123"),
            "sessionToken": None
        },
        {
            "_id": "usr_staff_1",
            "name": "Sunil Joshi (OPD Coordinator)",
            "email": "staff@queueseva.gov.in",
            "phone": "+91 98250 33445",
            "role": "staff",
            "counter": "Counter 2 (Check-in & Registration)",
            "passwordHash": hash_password("staff123"),
            "sessionToken": None
        },
        {
            "_id": "usr_lab_1",
            "name": "Priya Sharma (Chief Lab Tech)",
            "email": "lab@queueseva.gov.in",
            "phone": "+91 98250 55667",
            "role": "lab",
            "section": "Central Diagnostics & Pathology",
            "passwordHash": hash_password("lab123"),
            "sessionToken": None
        },
        {
            "_id": "usr_pharmacy_1",
            "name": "Vikram Desai (Pharmacist)",
            "email": "pharmacy@queueseva.gov.in",
            "phone": "+91 98250 77889",
            "role": "pharmacy",
            "dispensary": "Main Jan Aushadhi Dispensary",
            "passwordHash": hash_password("pharmacy123"),
            "sessionToken": None
        },
        {
            "_id": "usr_blood_1",
            "name": "Dr. Neha Shah (Blood Transfusion Officer)",
            "email": "bloodbank@queueseva.gov.in",
            "phone": "+91 98250 99001",
            "role": "bloodbank",
            "passwordHash": hash_password("blood123"),
            "sessionToken": None
        },
        {
            "_id": "usr_admin_1",
            "name": "H. M. Trivedi (Medical Superintendent)",
            "email": "admin@queueseva.gov.in",
            "phone": "+91 98250 00001",
            "role": "admin",
            "passwordHash": hash_password("admin123"),
            "sessionToken": None
        }
    ]

    for u in default_users:
        users_col.update_one({"email": u["email"]}, {"$set": u}, upsert=True)

    # 2. Seed Departments
    departments = [
        {"_id": "dept_gen_med", "name": "General Medicine", "code": "MED", "floor": "Ground Floor", "wing": "Wing A", "fee": 50},
        {"_id": "dept_cardio", "name": "Cardiology", "code": "CARD", "floor": "1st Floor", "wing": "Wing B", "fee": 100},
        {"_id": "dept_ortho", "name": "Orthopedics", "code": "ORTH", "floor": "Ground Floor", "wing": "Wing C", "fee": 80},
        {"_id": "dept_pedia", "name": "Pediatrics", "code": "PED", "floor": "2nd Floor", "wing": "Wing A", "fee": 50},
        {"_id": "dept_gynec", "name": "Gynecology & Obstetrics", "code": "GYN", "floor": "1st Floor", "wing": "Wing C", "fee": 60},
        {"_id": "dept_ent", "name": "ENT (Ear, Nose, Throat)", "code": "ENT", "floor": "2nd Floor", "wing": "Wing B", "fee": 50},
        {"_id": "dept_emergency", "name": "Emergency & Trauma", "code": "EMRG", "floor": "Ground Floor", "wing": "Red Zone", "fee": 0}
    ]
    for d in departments:
        depts_col.update_one({"_id": d["_id"]}, {"$set": d}, upsert=True)

    # 3. Seed Doctors
    doctors = [
        {
            "_id": "doc_aarav",
            "userId": "usr_doctor_1",
            "name": "Dr. Aarav Mehta",
            "qualification": "MD (Internal Medicine), AIIMS",
            "departmentId": "dept_gen_med",
            "departmentName": "General Medicine",
            "roomNumber": "OPD Room 3",
            "workingHours": "9:00 AM – 2:00 PM",
            "avgConsultationMins": 10,
            "status": "active"
        },
        {
            "_id": "doc_ananya",
            "name": "Dr. Ananya Roy",
            "qualification": "DM (Cardiology), PGI",
            "departmentId": "dept_cardio",
            "departmentName": "Cardiology",
            "roomNumber": "Room 102 (1st Floor)",
            "workingHours": "9:00 AM – 1:00 PM",
            "avgConsultationMins": 15,
            "status": "active"
        },
        {
            "_id": "doc_bhavik",
            "name": "Dr. Bhavik Solanki",
            "qualification": "MS (Orthopedics)",
            "departmentId": "dept_ortho",
            "departmentName": "Orthopedics",
            "roomNumber": "OPD Room 8",
            "workingHours": "10:00 AM – 3:00 PM",
            "avgConsultationMins": 12,
            "status": "active"
        },
        {
            "_id": "doc_kavita",
            "name": "Dr. Kavita Verma",
            "qualification": "MD (Pediatrics)",
            "departmentId": "dept_pedia",
            "departmentName": "Pediatrics",
            "roomNumber": "Room 205 (2nd Floor)",
            "workingHours": "9:00 AM – 2:00 PM",
            "avgConsultationMins": 10,
            "status": "active"
        }
    ]
    for doc in doctors:
        doctors_col.update_one({"_id": doc["_id"]}, {"$set": doc}, upsert=True)

    # 4. Seed Laboratory Tests
    lab_tests = [
        {"_id": "test_cbc", "name": "Complete Blood Count (CBC)", "category": "Hematology", "price": 100, "fastingRequired": False, "instructions": "No special preparation needed."},
        {"_id": "test_lft", "name": "Liver Function Test (LFT)", "category": "Biochemistry", "price": 180, "fastingRequired": True, "instructions": "Requires 8 hours overnight fasting."},
        {"_id": "test_kft", "name": "Kidney Function Test / Creatinine", "category": "Biochemistry", "price": 150, "fastingRequired": False, "instructions": "Stay normally hydrated."},
        {"_id": "test_sugar", "name": "Fasting Blood Sugar (FBS)", "category": "Biochemistry", "price": 50, "fastingRequired": True, "instructions": "Strict 8–10 hours fasting before sample collection."},
        {"_id": "test_lipid", "name": "Lipid Profile (Cholesterol)", "category": "Cardio-Diagnostics", "price": 200, "fastingRequired": True, "instructions": "12 hours fasting required."},
        {"_id": "test_xray", "name": "Chest X-Ray (PA View)", "category": "Radiology", "price": 150, "fastingRequired": False, "instructions": "Remove metal ornaments prior to imaging."},
        {"_id": "test_thyroid", "name": "Thyroid Profile (T3, T4, TSH)", "category": "Endocrinology", "price": 250, "fastingRequired": True, "instructions": "Morning empty-stomach sample preferred."},
        {"_id": "test_urine", "name": "Urine Routine & Microscopic", "category": "Pathology", "price": 60, "fastingRequired": False, "instructions": "Collect mid-stream clean urine sample."}
    ]
    for t in lab_tests:
        tests_col.update_one({"_id": t["_id"]}, {"$set": t}, upsert=True)

    # 5. Seed Medicines
    medicines = [
        {"_id": "med_pcm", "name": "Paracetamol 500mg Tablets", "generic": "Paracetamol", "stock": 850, "unit": "Tablets", "price": 12.0, "status": "In Stock", "dosageType": "Oral"},
        {"_id": "med_amox", "name": "Amoxicillin 500mg Capsules", "generic": "Amoxicillin", "stock": 320, "unit": "Capsules", "price": 45.0, "status": "In Stock", "dosageType": "Oral Antibiotic"},
        {"_id": "med_cet", "name": "Cetirizine 10mg Tablets", "generic": "Cetirizine HCl", "stock": 640, "unit": "Tablets", "price": 15.0, "status": "In Stock", "dosageType": "Antihistamine"},
        {"_id": "med_panto", "name": "Pantoprazole 40mg (Gastro-Resistant)", "generic": "Pantoprazole", "stock": 450, "unit": "Tablets", "price": 38.0, "status": "In Stock", "dosageType": "Antacid"},
        {"_id": "med_met", "name": "Metformin 500mg SR", "generic": "Metformin", "stock": 580, "unit": "Tablets", "price": 28.0, "status": "In Stock", "dosageType": "Antidiabetic"},
        {"_id": "med_azith", "name": "Azithromycin 500mg", "generic": "Azithromycin", "stock": 42, "unit": "Tablets", "price": 75.0, "status": "Low Stock", "dosageType": "Antibiotic"},
        {"_id": "med_ins", "name": "Human Insulin 40 IU/ml", "generic": "Regular Insulin", "stock": 18, "unit": "Vials", "price": 140.0, "status": "Low Stock", "dosageType": "Injectable"},
        {"_id": "med_ors", "name": "ORS Powder Sachet (WHO Formula)", "generic": "Oral Rehydration Salts", "stock": 900, "unit": "Sachets", "price": 10.0, "status": "In Stock", "dosageType": "Oral Solution"}
    ]
    for m in medicines:
        medicines_col.update_one({"_id": m["_id"]}, {"$set": m}, upsert=True)

    # 6. Seed Blood Bank Units
    blood_inventory = [
        {"_id": "bld_a_pos", "group": "A+", "component": "Whole Blood / PRBC", "unitsAvailable": 24, "status": "Available", "expiryWindowDays": 35},
        {"_id": "bld_a_neg", "group": "A-", "component": "Whole Blood / PRBC", "unitsAvailable": 6, "status": "Critical", "expiryWindowDays": 28},
        {"_id": "bld_b_pos", "group": "B+", "component": "Whole Blood / PRBC", "unitsAvailable": 32, "status": "Available", "expiryWindowDays": 40},
        {"_id": "bld_b_neg", "group": "B-", "component": "Whole Blood / PRBC", "unitsAvailable": 5, "status": "Critical", "expiryWindowDays": 30},
        {"_id": "bld_o_pos", "group": "O+", "component": "Whole Blood / PRBC", "unitsAvailable": 45, "status": "Available", "expiryWindowDays": 42},
        {"_id": "bld_o_neg", "group": "O-", "component": "Whole Blood (Universal Donor)", "unitsAvailable": 4, "status": "Emergency Reserve", "expiryWindowDays": 25},
        {"_id": "bld_ab_pos", "group": "AB+", "component": "Whole Blood / PRBC", "unitsAvailable": 14, "status": "Available", "expiryWindowDays": 35},
        {"_id": "bld_ab_neg", "group": "AB-", "component": "Whole Blood / PRBC", "unitsAvailable": 3, "status": "Critical", "expiryWindowDays": 20},
        {"_id": "bld_platelets", "group": "All Groups", "component": "Single Donor Platelets (SDP)", "unitsAvailable": 12, "status": "Available", "expiryWindowDays": 5}
    ]
    for b in blood_inventory:
        blood_col.update_one({"_id": b["_id"]}, {"$set": b}, upsert=True)

    # 7. Seed Hospital Locations (for Indoor Navigation)
    locations = [
        {"id": "loc_entrance", "name": "Main Hospital Gate & Reception", "type": "entrance", "x": 100, "y": 420, "floor": "Ground Floor", "desc": "Information desk, wheelchair assistance & triage."},
        {"id": "loc_reg", "name": "Registration & Check-In Counter", "type": "counter", "x": 220, "y": 380, "floor": "Ground Floor", "desc": "Counter 1-4 for walk-in slips and appointment check-in."},
        {"id": "loc_opd_med", "name": "OPD Room 3 (General Medicine)", "type": "doctor_room", "x": 360, "y": 280, "floor": "Ground Floor", "desc": "Dr. Aarav Mehta consulting room & waiting lounge."},
        {"id": "loc_opd_ortho", "name": "OPD Room 8 (Orthopedics)", "type": "doctor_room", "x": 480, "y": 280, "floor": "Ground Floor", "desc": "Dr. Bhavik Solanki consultation & plaster room."},
        {"id": "loc_lab", "name": "Central Pathology Laboratory", "type": "laboratory", "x": 360, "y": 140, "floor": "Ground Floor", "desc": "Sample collection counters 1-6 and report dispatch."},
        {"id": "loc_pharmacy", "name": "Jan Aushadhi Pharmacy", "type": "pharmacy", "x": 220, "y": 200, "floor": "Ground Floor", "desc": "Medicine collection counters 1-4 with digital queue display."},
        {"id": "loc_bloodbank", "name": "Regional Blood Bank & Transfusion", "type": "blood_bank", "x": 520, "y": 140, "floor": "Ground Floor", "desc": "Blood matching, storage and donation donor unit."},
        {"id": "loc_billing", "name": "Central Billing & Concession Desk", "type": "billing", "x": 220, "y": 290, "floor": "Ground Floor", "desc": "Cash receipts, PM-JAY and digital UPI counter."},
        {"id": "loc_emergency", "name": "Emergency & Trauma Red Zone", "type": "emergency", "x": 80, "y": 160, "floor": "Ground Floor", "desc": "24/7 dedicated ambulance bay and trauma center."},
        {"id": "loc_lift", "name": "Central Lifts & Disability Ramp", "type": "accessibility", "x": 300, "y": 250, "floor": "Ground Floor", "desc": "Braille-assisted lifts and wide ramp connecting Floor 1 & 2."},
        {"id": "loc_restroom", "name": "Accessible Restrooms", "type": "restroom", "x": 460, "y": 380, "floor": "Ground Floor", "desc": "Divyangjan accessible washrooms & water stations."}
    ]
    for loc in locations:
        locations_col.update_one({"id": loc["id"]}, {"$set": loc}, upsert=True)

    # 8. Seed Public Transport Stops
    transport_stops = [
        {"id": "tr_bus_1", "type": "Bus", "name": "Civil Hospital Main Gate Bus Stop", "distance": "50m (1 min walk)", "routes": "AMTS Routes: 40/1, 58, 66, 102", "freq": "Every 5 mins"},
        {"id": "tr_metro_1", "type": "Metro", "name": "Civil Hospital Metro Station (North-South Corridor)", "distance": "220m (3 min walk)", "routes": "Platform 1 & 2 toward APMC / Motera", "freq": "Every 8 mins"},
        {"id": "tr_auto_1", "type": "Auto-Rickshaw", "name": "Designated Prepaid Auto Stand", "distance": "80m", "routes": "Authorized meter stands with RTO prepaid kiosk", "freq": "24/7 Available"},
        {"id": "tr_parking_1", "type": "Parking", "name": "Patient & Attendant Multilevel Parking (P2)", "distance": "120m", "routes": "Free 2-wheeler and subsidized 4-wheeler parking", "freq": "Open 24 Hours"}
    ]
    for tr in transport_stops:
        transport_col.update_one({"id": tr["id"]}, {"$set": tr}, upsert=True)

    # 9. Seed Sample Department Queues & Initial Live Tokens
    queues = [
        {
            "_id": "q_dept_gen_med",
            "departmentId": "dept_gen_med",
            "departmentName": "General Medicine",
            "currentToken": "OPD-012",
            "servingDoctor": "Dr. Aarav Mehta",
            "room": "OPD Room 3",
            "status": "active", # active / paused
            "pauseReason": "",
            "waitingCount": 4,
            "avgWaitMins": 15
        },
        {
            "_id": "q_dept_cardio",
            "departmentId": "dept_cardio",
            "departmentName": "Cardiology",
            "currentToken": "CARD-005",
            "servingDoctor": "Dr. Ananya Roy",
            "room": "Room 102",
            "status": "active",
            "pauseReason": "",
            "waitingCount": 2,
            "avgWaitMins": 20
        },
        {
            "_id": "q_lab",
            "departmentId": "lab",
            "departmentName": "Pathology Laboratory",
            "currentToken": "LAB-008",
            "servingDoctor": "Priya Sharma (Counter 3)",
            "room": "Sample Counter 3",
            "status": "active",
            "pauseReason": "",
            "waitingCount": 3,
            "avgWaitMins": 8
        },
        {
            "_id": "q_pharmacy",
            "departmentId": "pharmacy",
            "departmentName": "Pharmacy Dispensary",
            "currentToken": "PHARM-015",
            "servingDoctor": "Vikram Desai (Counter 2)",
            "room": "Dispensing Counter 2",
            "status": "active",
            "pauseReason": "",
            "waitingCount": 5,
            "avgWaitMins": 6
        }
    ]
    for q in queues:
        queues_col.update_one({"_id": q["_id"]}, {"$set": q}, upsert=True)

    # Seed initial tokens
    sample_tokens = [
        {"tokenNumber": "OPD-010", "patientName": "Kantilal Shah", "patientPhone": "9825100001", "departmentId": "dept_gen_med", "status": "served", "priority": "normal", "serviceCounter": "OPD Room 3"},
        {"tokenNumber": "OPD-011", "patientName": "Fatima Bi", "patientPhone": "9825100002", "departmentId": "dept_gen_med", "status": "served", "priority": "normal", "serviceCounter": "OPD Room 3"},
        {"tokenNumber": "OPD-012", "patientName": "Ramesh Patel", "patientPhone": "9876543210", "departmentId": "dept_gen_med", "status": "in_consultation", "priority": "normal", "serviceCounter": "OPD Room 3"},
        {"tokenNumber": "OPD-013", "patientName": "Dinesh Solanki", "patientPhone": "9825100003", "departmentId": "dept_gen_med", "status": "waiting", "priority": "normal", "serviceCounter": "OPD Room 3"},
        {"tokenNumber": "OPD-014", "patientName": "Meena Dave", "patientPhone": "9825100004", "departmentId": "dept_gen_med", "status": "waiting", "priority": "urgent", "serviceCounter": "OPD Room 3", "priorityReason": "High fever with chills"},
        {"tokenNumber": "LAB-008", "patientName": "Ramesh Patel", "patientPhone": "9876543210", "departmentId": "lab", "status": "waiting", "priority": "normal", "serviceCounter": "Sample Counter 3"},
        {"tokenNumber": "PHARM-015", "patientName": "Geeta Sharma", "patientPhone": "9825100005", "departmentId": "pharmacy", "status": "waiting", "priority": "normal", "serviceCounter": "Dispensing Counter 2"}
    ]
    for st in sample_tokens:
        tokens_col.update_one({"tokenNumber": st["tokenNumber"]}, {"$set": st}, upsert=True)

    # Seed sample bill for Ramesh Patel
    sample_bill = {
        "_id": "bill_ramesh_001",
        "invoiceNumber": "QS-INV-2026-0891",
        "patientId": "usr_patient_1",
        "patientName": "Ramesh Patel",
        "items": [
            {"name": "OPD Consultation (General Medicine)", "qty": 1, "rate": 50, "total": 50},
            {"name": "Complete Blood Count (CBC) Lab Test", "qty": 1, "rate": 100, "total": 100},
            {"name": "Paracetamol 500mg (10 tabs)", "qty": 1, "rate": 12, "total": 12}
        ],
        "subtotal": 162.0,
        "concession": 0.0,
        "total": 162.0,
        "status": "pending",  # pending / paid / waived
        "paymentMode": None,
        "receiptNo": None
    }
    bills_col.update_one({"_id": sample_bill["_id"]}, {"$set": sample_bill}, upsert=True)

    print(">> QueueSeva Database successfully seeded with full hospital datasets!")

if __name__ == "__main__":
    seed_database()
