"""
QueueSeva - Smart Government Hospital Management, Appointments, Queue & Healthcare Services
Core Flask Application and REST API Layer
"""

import os
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory, g
from db import get_db, get_collection
from security import (
    hash_password, check_password, generate_session_token,
    require_auth, get_current_user, log_audit, log_security_event, sanitize_input
)
from recommender import recommend_appointment
from seed_data import seed_database

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.environ.get("SECRET_KEY", "queueseva-gov-in-secure-key-2026")

# Security Response Headers Middleware
@app.after_request
def apply_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# ----------------- Seed Database on Startup -----------------
try:
    seed_database()
except Exception as e:
    print(f"Seed error: {e}")

# ----------------- Frontend Route -----------------
@app.route("/")
def index():
    return render_template("index.html")

# ----------------- 1. Authentication & User Profile -----------------
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json or {}
    name = sanitize_input(data.get("name", "").strip())
    email = sanitize_input(data.get("email", "").strip().lower())
    password = data.get("password", "")
    phone = sanitize_input(data.get("phone", "").strip())
    age = data.get("age", 30)
    gender = sanitize_input(data.get("gender", "Other"))
    emergency_contact = sanitize_input(data.get("emergencyContact", ""))
    allergies = data.get("allergies", [])

    if not email or not password or not name:
        return jsonify({"error": "Name, email, and password are required."}), 400

    users_col = get_collection("users")
    if users_col.find_one({"email": email}):
        return jsonify({"error": "An account with this email already exists."}), 409

    user_doc = {
        "_id": str(uuid.uuid4()),
        "name": name,
        "email": email,
        "phone": phone,
        "age": int(age) if str(age).isdigit() else 30,
        "gender": gender,
        "role": "patient",
        "emergencyContact": emergency_contact,
        "allergies": allergies if isinstance(allergies, list) else [allergies],
        "passwordHash": hash_password(password),
        "sessionToken": generate_session_token(),
        "createdAt": datetime.utcnow().isoformat()
    }
    users_col.insert_one(user_doc)
    log_audit(user_doc["_id"], email, "patient", "PATIENT_REGISTERED", {"name": name})

    user_info = {k: v for k, v in user_doc.items() if k != "passwordHash"}
    return jsonify({"message": "Registration successful.", "user": user_info, "token": user_doc["sessionToken"]})

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    users_col = get_collection("users")
    user = users_col.find_one({"email": email})

    if not user or not check_password(password, user.get("passwordHash", "")):
        log_security_event("LOGIN_FAILED", "MEDIUM", {"attemptedEmail": email})
        return jsonify({"error": "Invalid email credentials or password."}), 401

    token = generate_session_token()
    users_col.update_one({"_id": user["_id"]}, {"$set": {"sessionToken": token, "lastLogin": datetime.utcnow().isoformat()}})
    log_audit(str(user["_id"]), user["email"], user["role"], "LOGIN_SUCCESS", {"ip": request.remote_addr})

    user_info = {k: v for k, v in user.items() if k != "passwordHash"}
    user_info["sessionToken"] = token
    return jsonify({"message": "Login successful.", "user": user_info, "token": token})

@app.route("/api/auth/me", methods=["GET"])
def me():
    user = get_current_user()
    if not user:
        return jsonify({"user": None}), 200
    user_info = {k: v for k, v in user.items() if k != "passwordHash"}
    return jsonify({"user": user_info})

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    user = get_current_user()
    if user:
        get_collection("users").update_one({"_id": user["_id"]}, {"$set": {"sessionToken": None}})
        log_audit(str(user["_id"]), user["email"], user["role"], "LOGOUT", {})
    return jsonify({"message": "Logged out successfully."})

# ----------------- 2. Reference Catalogs -----------------
@app.route("/api/departments", methods=["GET"])
def get_departments():
    depts = get_collection("departments").find()
    return jsonify(depts)

@app.route("/api/doctors", methods=["GET"])
def get_doctors():
    dept_id = request.args.get("departmentId")
    query = {"status": "active"}
    if dept_id:
        query["departmentId"] = dept_id
    docs = get_collection("doctors").find(query)
    return jsonify(docs)

# ----------------- 3. Smart Appointment Recommendation & Booking -----------------
@app.route("/api/recommend-appointment", methods=["POST"])
def get_recommendation():
    data = request.json or {}
    date_str = data.get("date", datetime.utcnow().strftime("%Y-%m-%d"))
    time_range_key = data.get("timeRangeKey", "morning_mid")
    dept_id = data.get("departmentId", "dept_gen_med")
    doctor_id = data.get("doctorId", "any")
    has_accessibility = bool(data.get("hasAccessibilityNeed", False))

    rec = recommend_appointment(date_str, time_range_key, dept_id, doctor_id, has_accessibility)
    return jsonify(rec)

@app.route("/api/appointments/book", methods=["POST"])
@require_auth()
def book_appointment():
    user = g.user
    data = request.json or {}
    dept_id = data.get("departmentId", "dept_gen_med")
    doctor_id = data.get("doctorId")
    date_str = data.get("date", datetime.utcnow().strftime("%Y-%m-%d"))
    time_range_key = data.get("timeRangeKey", "morning_mid")
    slot_time = data.get("slotTime", "10:00 AM")
    arrival_window = data.get("arrivalWindow", "9:45 AM – 9:55 AM")
    attendant_name = sanitize_input(data.get("attendantName", ""))

    depts_col = get_collection("departments")
    doctors_col = get_collection("doctors")
    dept = depts_col.find_one({"_id": dept_id}) or {"name": "General OPD"}
    doc = doctors_col.find_one({"_id": doctor_id}) or {"name": "Consulting Doctor", "roomNumber": "Room 3"}

    appt_id = f"QS-APT-{secrets_rand()}"
    appointment = {
        "_id": str(uuid.uuid4()),
        "appointmentId": appt_id,
        "patientId": str(user["_id"]),
        "patientName": user["name"],
        "patientPhone": user.get("phone", ""),
        "departmentId": dept_id,
        "departmentName": dept.get("name"),
        "doctorId": doctor_id,
        "doctorName": doc.get("name"),
        "roomNumber": doc.get("roomNumber", "Room 3"),
        "date": date_str,
        "timeRangeKey": time_range_key,
        "slotTime": slot_time,
        "arrivalWindow": arrival_window,
        "attendantName": attendant_name,
        "status": "confirmed",  # confirmed -> arrived -> checked_in -> in_consultation -> completed -> cancelled
        "tokenNumber": None,
        "createdAt": datetime.utcnow().isoformat()
    }

    get_collection("appointments").insert_one(appointment)
    log_audit(str(user["_id"]), user["email"], user["role"], "APPOINTMENT_BOOKED", {"apptId": appt_id, "dept": dept.get("name")})

    return jsonify({"message": "Appointment confirmed successfully!", "appointment": appointment})

def secrets_rand():
    import random
    return random.randint(10000, 99999)

@app.route("/api/appointments/my", methods=["GET"])
@require_auth()
def get_my_appointments():
    user = g.user
    appts = get_collection("appointments").find({"patientId": str(user["_id"])})
    # Sort reverse chronological
    appts.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return jsonify(appts)

@app.route("/api/appointments/<appt_id>/cancel", methods=["POST"])
@require_auth()
def cancel_appointment(appt_id):
    user = g.user
    col = get_collection("appointments")
    appt = col.find_one({"appointmentId": appt_id})
    if not appt:
        return jsonify({"error": "Appointment not found."}), 404
    if appt.get("patientId") != str(user["_id"]) and user.get("role") not in ["staff", "admin"]:
        return jsonify({"error": "Unauthorized to cancel this appointment."}), 403

    col.update_one({"appointmentId": appt_id}, {"$set": {"status": "cancelled", "cancelledAt": datetime.utcnow().isoformat()}})
    log_audit(str(user["_id"]), user["email"], user["role"], "APPOINTMENT_CANCELLED", {"apptId": appt_id})
    return jsonify({"message": "Appointment cancelled successfully."})

# ----------------- 4. Live Queue & Geofence Arrival -----------------
@app.route("/api/queue/live", methods=["GET"])
def get_live_queues():
    queues = get_collection("queues").find()
    # If user is logged in, attach their active token info
    user = get_current_user()
    user_token = None
    if user:
        user_token = get_collection("tokens").find_one({
            "patientPhone": user.get("phone"),
            "status": {"$in": ["waiting", "called", "in_consultation"]}
        })

    return jsonify({"queues": queues, "userActiveToken": user_token})

@app.route("/api/geofence/arrival", methods=["POST"])
@require_auth(roles=["patient"])
def report_arrival():
    """
    Simulated or real GPS geofence arrival detection.
    When patient is detected within 150m of hospital coordinates.
    """
    user = g.user
    data = request.json or {}
    lat = data.get("lat")
    lng = data.get("lng")
    distance_meters = data.get("distanceMeters", 120)

    # Hospital reference coordinates: 23.0525° N, 72.5855° E (Ahmedabad Civil Hospital)
    is_inside_geofence = distance_meters <= 200

    if is_inside_geofence:
        # Check if patient has a confirmed appointment for today
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        appts_col = get_collection("appointments")
        appt = appts_col.find_one({
            "patientId": str(user["_id"]),
            "status": "confirmed"
        })
        if appt:
            appts_col.update_one({"_id": appt["_id"]}, {"$set": {"status": "arrived", "arrivedAt": datetime.utcnow().isoformat()}})
            log_audit(str(user["_id"]), user["email"], "patient", "HOSPITAL_ARRIVAL_DETECTED", {"distance": distance_meters})

        return jsonify({
            "insideGeofence": True,
            "distanceMeters": distance_meters,
            "message": "Welcome to QueueSeva! Your arrival has been detected. Please confirm check-in to receive your digital token."
        })
    else:
        return jsonify({
            "insideGeofence": False,
            "distanceMeters": distance_meters,
            "message": f"You are currently {distance_meters}m away from the hospital. Geofence triggers automatically at 200m."
        })

@app.route("/api/queue/checkin", methods=["POST"])
@require_auth()
def check_in_patient():
    """Converts confirmed appointment into checked-in status and issues token"""
    user = g.user
    data = request.json or {}
    appt_id = data.get("appointmentId")
    appts_col = get_collection("appointments")
    tokens_col = get_collection("tokens")
    queues_col = get_collection("queues")

    appt = appts_col.find_one({"appointmentId": appt_id})
    if not appt:
        return jsonify({"error": "Appointment not found."}), 404

    # Generate token
    dept_id = appt.get("departmentId", "dept_gen_med")
    prefix = "OPD"
    if "card" in dept_id:
        prefix = "CARD"
    elif "ortho" in dept_id:
        prefix = "ORTH"
    elif "pedia" in dept_id:
        prefix = "PED"

    token_count = tokens_col.count_documents({"departmentId": dept_id}) + 1
    token_num = f"{prefix}-{token_count:03d}"

    token_doc = {
        "_id": str(uuid.uuid4()),
        "tokenNumber": token_num,
        "patientId": appt.get("patientId"),
        "patientName": appt.get("patientName"),
        "patientPhone": appt.get("patientPhone"),
        "appointmentId": appt_id,
        "departmentId": dept_id,
        "serviceCounter": appt.get("roomNumber", "Room 3"),
        "status": "waiting",
        "priority": "normal",
        "createdAt": datetime.utcnow().isoformat()
    }
    tokens_col.insert_one(token_doc)

    appts_col.update_one({"appointmentId": appt_id}, {"$set": {"status": "checked_in", "tokenNumber": token_num}})
    queues_col.update_one({"departmentId": dept_id}, {"$inc": {"waitingCount": 1}})

    log_audit(str(user["_id"]), user["email"], user["role"], "CHECKIN_COMPLETED", {"token": token_num, "apptId": appt_id})
    return jsonify({"message": f"Check-in successful! Token: {token_num}", "token": token_doc})

# ----------------- 5. Doctor Consultation Workflow -----------------
@app.route("/api/doctors/status", methods=["GET"])
def get_doctors_status():
    """Returns live availability and consultation status of all OPD Doctors"""
    docs_col = get_collection("doctors")
    tokens_col = get_collection("tokens")
    doctors = docs_col.find({"status": "active"})

    results = []
    for doc in doctors:
        # Check if doctor has active patient in room
        active_token = tokens_col.find_one({
            "serviceCounter": doc.get("roomNumber", "Room 3"),
            "status": "in_consultation"
        })
        is_free = active_token is None
        doc_info = dict(doc)
        doc_info["consultationStatus"] = "free" if is_free else "busy"
        doc_info["currentPatient"] = active_token
        results.append(doc_info)
    return jsonify(results)

@app.route("/api/staff/process-to-doctor", methods=["POST"])
@require_auth(roles=["staff", "admin"])
def staff_process_to_doctor():
    """Staff dispatches next waiting token to an available / free Doctor Room"""
    data = request.json or {}
    token_num = data.get("tokenNumber")
    doctor_id = data.get("doctorId")
    lang = data.get("language", "en")

    tokens_col = get_collection("tokens")
    docs_col = get_collection("doctors")
    queues_col = get_collection("queues")

    doc = docs_col.find_one({"_id": doctor_id})
    if not doc:
        return jsonify({"error": "Doctor room not found"}), 404

    room = doc.get("roomNumber", "OPD Room 3")

    # If no specific token supplied, pick next waiting token for this department
    if not token_num:
        waiting = tokens_col.find_one({"departmentId": doc.get("departmentId"), "status": "waiting"})
        if not waiting:
            return jsonify({"error": f"No patients currently waiting for {doc.get('departmentName')}."}), 400
        token_num = waiting["tokenNumber"]
        token_doc = waiting
    else:
        token_doc = tokens_col.find_one({"tokenNumber": token_num})

    if not token_doc:
        return jsonify({"error": "Token not found"}), 404

    # Assign token to doctor room
    tokens_col.update_one({"tokenNumber": token_num}, {
        "$set": {
            "status": "in_consultation",
            "serviceCounter": room,
            "calledAt": datetime.utcnow().isoformat()
        }
    })

    queues_col.update_one({"departmentId": doc.get("departmentId")}, {
        "$set": {"currentToken": token_num},
        "$inc": {"waitingCount": -1}
    })

    if lang == "hi":
        announcement = f"टोकन नंबर {token_num}, कृपया {room} ({doc.get('name')}) में पधारें।"
    elif lang == "gu":
        announcement = f"ટોકન નંબર {token_num}, કૃપા કરીને {room} ({doc.get('name')}) માં જાવ."
    else:
        announcement = f"Token number {token_num}, please proceed to {room} for consultation with {doc.get('name')}."

    log_audit(str(g.user["_id"]), g.user["email"], "staff", "PATIENT_PROCESSED_TO_DOCTOR", {
        "token": token_num, "room": room, "doctor": doc.get("name")
    })

    return jsonify({
        "message": f"Token {token_num} successfully assigned to {doc.get('name')} ({room})",
        "announcementText": announcement,
        "token": token_doc,
        "doctor": doc
    })

@app.route("/api/doctor/queue", methods=["GET"])
@require_auth(roles=["doctor", "admin"])
def get_doctor_queue():
    tokens = get_collection("tokens").find({"status": {"$in": ["waiting", "called", "in_consultation"]}})
    current_token = get_collection("tokens").find_one({"status": "in_consultation"})
    return jsonify({"queue": tokens, "currentPatient": current_token})

@app.route("/api/doctor/consultation/call-next", methods=["POST"])
@require_auth(roles=["doctor", "staff", "admin"])
def doctor_call_next():
    tokens_col = get_collection("tokens")
    queues_col = get_collection("queues")

    # Mark currently active patient as completed
    current = tokens_col.find_one({"status": "in_consultation"})
    if current:
        tokens_col.update_one({"_id": current["_id"]}, {"$set": {"status": "served", "completedAt": datetime.utcnow().isoformat()}})

    # Find next patient in waiting queue (prioritizing urgent)
    waiting_urgent = tokens_col.find_one({"status": "waiting", "priority": "urgent"})
    next_patient = waiting_urgent or tokens_col.find_one({"status": "waiting"})

    if not next_patient:
        return jsonify({"message": "No patients currently waiting in queue.", "token": None})

    tokens_col.update_one({"_id": next_patient["_id"]}, {"$set": {"status": "in_consultation", "calledAt": datetime.utcnow().isoformat()}})
    queues_col.update_one({"departmentId": next_patient.get("departmentId")}, {
        "$set": {"currentToken": next_patient["tokenNumber"]},
        "$inc": {"waitingCount": -1}
    })

    log_audit(str(g.user["_id"]), g.user["email"], "doctor", "CONSULTATION_STARTED", {"token": next_patient["tokenNumber"]})

    announcement_text = f"Token {next_patient['tokenNumber']}, please proceed to {next_patient.get('serviceCounter', 'Doctor Consultation Room 3')}."
    return jsonify({
        "message": f"Called patient {next_patient['tokenNumber']}",
        "token": next_patient,
        "announcementText": announcement_text
    })

@app.route("/api/doctor/consultation/finish", methods=["POST"])
@require_auth(roles=["doctor", "admin"])
def doctor_finish_consultation():
    data = request.json or {}
    token_num = data.get("tokenNumber")
    notes = sanitize_input(data.get("notes", ""))
    medicines_list = data.get("medicines", [])
    lab_tests_list = data.get("labTests", [])
    blood_needed = data.get("bloodRequest")
    follow_up_days = data.get("followUpDays", 7)

    tokens_col = get_collection("tokens")
    prescriptions_col = get_collection("prescriptions")
    lab_orders_col = get_collection("labOrders")
    pharm_orders_col = get_collection("pharmacyOrders")
    blood_reqs_col = get_collection("bloodRequests")
    bills_col = get_collection("bills")

    token_doc = tokens_col.find_one({"tokenNumber": token_num}) or {}
    patient_id = token_doc.get("patientId", "usr_patient_1")
    patient_name = token_doc.get("patientName", "Patient")

    # 1. Create Prescription
    rx_id = f"QS-RX-{secrets_rand()}"
    prescription = {
        "_id": str(uuid.uuid4()),
        "prescriptionId": rx_id,
        "tokenNumber": token_num,
        "patientId": patient_id,
        "patientName": patient_name,
        "doctorName": g.user.get("name", "Dr. Aarav Mehta"),
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "notes": notes,
        "medicines": medicines_list,
        "followUpDate": (datetime.utcnow()).strftime("%Y-%m-%d"),
        "followUpDays": follow_up_days,
        "createdAt": datetime.utcnow().isoformat()
    }
    prescriptions_col.insert_one(prescription)

    bill_items = [{"name": "OPD Consultation Fee", "qty": 1, "rate": 50, "total": 50}]

    # 2. Pharmacy Order dispatch
    if medicines_list:
        pharm_order = {
            "_id": str(uuid.uuid4()),
            "prescriptionId": rx_id,
            "patientName": patient_name,
            "medicines": medicines_list,
            "status": "pending",  # pending -> preparing -> ready -> dispensed
            "createdAt": datetime.utcnow().isoformat()
        }
        pharm_orders_col.insert_one(pharm_order)
        for med in medicines_list:
            bill_items.append({"name": f"Med: {med.get('name')}", "qty": 1, "rate": med.get('price', 20), "total": med.get('price', 20)})

    # 3. Lab Orders dispatch
    if lab_tests_list:
        for t in lab_tests_list:
            lab_order = {
                "_id": str(uuid.uuid4()),
                "testId": t.get("id"),
                "testName": t.get("name"),
                "patientId": patient_id,
                "patientName": patient_name,
                "orderedBy": g.user.get("name"),
                "status": "pending_collection",  # pending_collection -> collected -> processing -> report_ready
                "report": None,
                "price": t.get("price", 100),
                "createdAt": datetime.utcnow().isoformat()
            }
            lab_orders_col.insert_one(lab_order)
            bill_items.append({"name": f"Lab: {t.get('name')}", "qty": 1, "rate": t.get('price', 100), "total": t.get('price', 100)})

    # 4. Blood Request dispatch
    if blood_needed:
        blood_req = {
            "_id": str(uuid.uuid4()),
            "group": blood_needed.get("group", "O+"),
            "component": blood_needed.get("component", "PRBC"),
            "units": blood_needed.get("units", 1),
            "patientName": patient_name,
            "doctorName": g.user.get("name"),
            "urgency": blood_needed.get("urgency", "Routine"),
            "status": "requested",  # requested -> under_review -> approved -> fulfilled
            "createdAt": datetime.utcnow().isoformat()
        }
        blood_reqs_col.insert_one(blood_req)

    # 5. Generate / Update Bill
    subtotal = sum(i["total"] for i in bill_items)
    bill_doc = {
        "_id": str(uuid.uuid4()),
        "invoiceNumber": f"QS-INV-{secrets_rand()}",
        "patientId": patient_id,
        "patientName": patient_name,
        "items": bill_items,
        "subtotal": subtotal,
        "concession": 0.0,
        "total": subtotal,
        "status": "pending",
        "createdAt": datetime.utcnow().isoformat()
    }
    bills_col.insert_one(bill_doc)

    # 6. Record consultation entry
    consultation_doc = {
        "_id": str(uuid.uuid4()),
        "tokenNumber": token_num,
        "patientName": patient_name,
        "doctorName": g.user.get("name", "Dr. Aarav Mehta"),
        "departmentId": token_doc.get("departmentId", "dept_gen_med"),
        "roomNumber": token_doc.get("serviceCounter", "OPD Room 3"),
        "prescriptionId": rx_id,
        "completedAt": datetime.utcnow().strftime("%I:%M %p"),
        "status": "Consulted & Free"
    }
    get_collection("consultations").insert_one(consultation_doc)

    # Mark token served
    tokens_col.update_one({"tokenNumber": token_num}, {"$set": {"status": "served", "completedAt": datetime.utcnow().isoformat()}})
    log_audit(str(g.user["_id"]), g.user["email"], "doctor", "CONSULTATION_COMPLETED", {"rxId": rx_id, "token": token_num})

    return jsonify({"message": "Consultation finalized, doctor is now FREE for next patient!", "prescription": prescription, "bill": bill_doc})

@app.route("/api/doctor/consulted-today", methods=["GET"])
def get_consulted_today():
    """Returns list of patients successfully consulted today and removed from active queue"""
    dept_id = request.args.get("departmentId")
    query = {}
    if dept_id:
        query["departmentId"] = dept_id
    records = get_collection("consultations").find(query)
    records.sort(key=lambda x: x.get("completedAt", ""), reverse=True)
    return jsonify(records)

# ----------------- 6. Staff Operations & Audio Announcements -----------------
@app.route("/api/staff/walkin-token", methods=["POST"])
@require_auth(roles=["staff", "admin"])
def generate_walkin_token():
    data = request.json or {}
    name = sanitize_input(data.get("name", "Walk-in Patient"))
    phone = sanitize_input(data.get("phone", "0000000000"))
    dept_id = data.get("departmentId", "dept_gen_med")
    priority = data.get("priority", "normal")
    priority_reason = sanitize_input(data.get("priorityReason", ""))

    tokens_col = get_collection("tokens")
    prefix = "OPD"
    if "card" in dept_id:
        prefix = "CARD"
    elif "ortho" in dept_id:
        prefix = "ORTH"

    token_count = tokens_col.count_documents({"departmentId": dept_id}) + 1
    token_num = f"{prefix}-{token_count:03d}"

    token_doc = {
        "_id": str(uuid.uuid4()),
        "tokenNumber": token_num,
        "patientName": name,
        "patientPhone": phone,
        "departmentId": dept_id,
        "serviceCounter": "OPD Room 3",
        "status": "waiting",
        "priority": priority,
        "priorityReason": priority_reason,
        "createdAt": datetime.utcnow().isoformat()
    }
    tokens_col.insert_one(token_doc)
    get_collection("queues").update_one({"departmentId": dept_id}, {"$inc": {"waitingCount": 1}})

    log_audit(str(g.user["_id"]), g.user["email"], "staff", "WALKIN_TOKEN_GENERATED", {"token": token_num, "priority": priority})
    return jsonify({"message": f"Walk-in token {token_num} issued.", "token": token_doc})

@app.route("/api/staff/call-token", methods=["POST"])
@require_auth(roles=["staff", "doctor", "admin"])
def staff_call_token():
    data = request.json or {}
    token_num = data.get("tokenNumber")
    dept_id = data.get("departmentId", "dept_gen_med")
    lang = data.get("language", "en")  # en, hi, gu

    tokens_col = get_collection("tokens")
    token_doc = tokens_col.find_one({"tokenNumber": token_num})
    if not token_doc:
        return jsonify({"error": "Token not found"}), 404

    tokens_col.update_one({"tokenNumber": token_num}, {"$set": {"status": "called", "calledAt": datetime.utcnow().isoformat()}})
    get_collection("queues").update_one({"departmentId": dept_id}, {"$set": {"currentToken": token_num}})

    # Audio synthesis text generation
    room = token_doc.get("serviceCounter", "Room 3")
    if lang == "hi":
        announcement = f"टोकन नंबर {token_num}, कृपया {room} में पधारें।"
    elif lang == "gu":
        announcement = f"ટોકન નંબર {token_num}, કૃપા કરીને {room} માં જાવ."
    else:
        announcement = f"Token number {token_num}, please proceed to {room}."

    log_audit(str(g.user["_id"]), g.user["email"], "staff", "TOKEN_ANNOUNCED", {"token": token_num, "room": room})
    return jsonify({"message": "Token called.", "announcementText": announcement, "token": token_doc})

@app.route("/api/staff/pause-queue", methods=["POST"])
@require_auth(roles=["staff", "doctor", "admin"])
def toggle_pause_queue():
    data = request.json or {}
    dept_id = data.get("departmentId", "dept_gen_med")
    reason = sanitize_input(data.get("reason", "Doctor on emergency rounds"))
    action = data.get("action", "pause")  # pause / resume

    q_col = get_collection("queues")
    new_status = "paused" if action == "pause" else "active"
    q_col.update_one({"departmentId": dept_id}, {"$set": {"status": new_status, "pauseReason": reason if action == "pause" else ""}})

    log_audit(str(g.user["_id"]), g.user["email"], "staff", f"QUEUE_{action.upper()}", {"dept": dept_id, "reason": reason})
    return jsonify({"message": f"Department queue is now {new_status}.", "status": new_status})

# ----------------- 7. Laboratory Workflow -----------------
@app.route("/api/lab/tests", methods=["GET"])
def get_lab_tests():
    return jsonify(get_collection("labTests").find())

@app.route("/api/lab/orders", methods=["GET"])
@require_auth(roles=["lab", "doctor", "admin", "patient"])
def get_lab_orders():
    user = g.user
    orders_col = get_collection("labOrders")
    if user.get("role") == "patient":
        orders = orders_col.find({"patientId": str(user["_id"])})
    else:
        orders = orders_col.find()
    orders.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return jsonify(orders)

@app.route("/api/lab/orders/update-status", methods=["POST"])
@require_auth(roles=["lab", "admin"])
def update_lab_status():
    data = request.json or {}
    order_id = data.get("orderId")
    status = data.get("status")  # collected, processing, report_ready
    report_text = sanitize_input(data.get("reportText", "All parameters within normal reference ranges."))

    col = get_collection("labOrders")
    update_data = {"status": status}
    if status == "report_ready":
        update_data["report"] = {
            "result": report_text,
            "verifiedBy": g.user.get("name", "Priya Sharma"),
            "completedAt": datetime.utcnow().isoformat()
        }

    col.update_one({"_id": order_id}, {"$set": update_data})
    log_audit(str(g.user["_id"]), g.user["email"], "lab", "LAB_ORDER_STATUS_UPDATED", {"orderId": order_id, "status": status})
    return jsonify({"message": f"Lab order updated to {status}."})

# ----------------- 8. Pharmacy Workflow -----------------
@app.route("/api/pharmacy/medicines", methods=["GET"])
def get_pharmacy_medicines():
    return jsonify(get_collection("medicines").find())

@app.route("/api/pharmacy/orders", methods=["GET"])
@require_auth(roles=["pharmacy", "doctor", "admin"])
def get_pharmacy_orders():
    orders = get_collection("pharmacyOrders").find()
    orders.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return jsonify(orders)

@app.route("/api/pharmacy/dispense", methods=["POST"])
@require_auth(roles=["pharmacy", "admin"])
def dispense_prescription():
    data = request.json or {}
    order_id = data.get("orderId")
    col = get_collection("pharmacyOrders")
    col.update_one({"_id": order_id}, {"$set": {"status": "dispensed", "dispensedAt": datetime.utcnow().isoformat(), "dispensedBy": g.user.get("name")}})
    log_audit(str(g.user["_id"]), g.user["email"], "pharmacy", "PRESCRIPTION_DISPENSED", {"orderId": order_id})
    return jsonify({"message": "Medicine dispensed successfully."})

# ----------------- 9. Blood Bank Workflow -----------------
@app.route("/api/bloodbank/inventory", methods=["GET"])
def get_blood_inventory():
    return jsonify(get_collection("bloodInventory").find())

@app.route("/api/bloodbank/requests", methods=["GET"])
@require_auth(roles=["bloodbank", "doctor", "admin"])
def get_blood_requests():
    reqs = get_collection("bloodRequests").find()
    reqs.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return jsonify(reqs)

@app.route("/api/bloodbank/request/create", methods=["POST"])
@require_auth()
def create_blood_request():
    data = request.json or {}
    group = data.get("group", "O+")
    units = int(data.get("units", 1))
    urgency = data.get("urgency", "Routine")
    patient_name = sanitize_input(data.get("patientName", g.user.get("name")))

    req_doc = {
        "_id": str(uuid.uuid4()),
        "group": group,
        "component": "Whole Blood / PRBC",
        "units": units,
        "patientName": patient_name,
        "urgency": urgency,
        "status": "requested",
        "createdAt": datetime.utcnow().isoformat()
    }
    get_collection("bloodRequests").insert_one(req_doc)
    log_audit(str(g.user["_id"]), g.user["email"], g.user["role"], "BLOOD_REQUESTED", {"group": group, "units": units, "urgency": urgency})
    return jsonify({"message": "Blood request recorded successfully.", "request": req_doc})

@app.route("/api/bloodbank/request/update", methods=["POST"])
@require_auth(roles=["bloodbank", "admin"])
def update_blood_request():
    data = request.json or {}
    req_id = data.get("requestId")
    status = data.get("status", "fulfilled")

    get_collection("bloodRequests").update_one({"_id": req_id}, {"$set": {"status": status, "updatedAt": datetime.utcnow().isoformat()}})
    log_audit(str(g.user["_id"]), g.user["email"], "bloodbank", "BLOOD_REQUEST_UPDATED", {"id": req_id, "status": status})
    return jsonify({"message": f"Blood request marked as {status}."})

# ----------------- 10. Billing and Payments -----------------
@app.route("/api/billing/bills", methods=["GET"])
@require_auth()
def get_bills():
    user = g.user
    bills_col = get_collection("bills")
    if user.get("role") == "patient":
        bills = bills_col.find({"patientId": str(user["_id"])})
    else:
        bills = bills_col.find()
    bills.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return jsonify(bills)

@app.route("/api/billing/pay", methods=["POST"])
@require_auth()
def pay_bill():
    data = request.json or {}
    bill_id = data.get("billId")
    mode = data.get("mode", "Online Simulator")  # Online Simulator / Cash at Counter / PM-JAY Exemption

    receipt_no = f"REC-QS-{secrets_rand()}"
    col = get_collection("bills")
    col.update_one({"_id": bill_id}, {
        "$set": {
            "status": "paid",
            "paymentMode": mode,
            "receiptNo": receipt_no,
            "paidAt": datetime.utcnow().isoformat()
        }
    })
    log_audit(str(g.user["_id"]), g.user["email"], g.user["role"], "BILL_PAID", {"billId": bill_id, "receipt": receipt_no, "mode": mode})
    return jsonify({"message": "Payment recorded successfully!", "receiptNo": receipt_no})

# ----------------- 11. Navigation & Public Transport -----------------
@app.route("/api/navigation/locations", methods=["GET"])
def get_hospital_locations():
    return jsonify(get_collection("hospitalLocations").find())

@app.route("/api/navigation/transport", methods=["GET"])
def get_transport_nodes():
    return jsonify(get_collection("transportLocations").find())

# ----------------- 12. Emergency Services -----------------
@app.route("/api/emergency/assist", methods=["POST"])
def emergency_assist():
    data = request.json or {}
    caller_phone = sanitize_input(data.get("phone", "Anonymous"))
    patient_condition = sanitize_input(data.get("condition", "Critical trauma / acute distress"))

    log_security_event("EMERGENCY_TRIGGERED", "CRITICAL", {"phone": caller_phone, "condition": patient_condition})

    return jsonify({
        "status": "ACTIVE_EMERGENCY_DISPATCH",
        "instructions": "Do not wait for an online appointment or billing. Proceed directly to Emergency Red Zone Gate 1.",
        "hospitalEmergencyHotline": "+91 79 2268 0000 / 108 Ambulance",
        "traumaDutyOfficer": "Dr. Sandeep Patel (Emergency Triage Head)",
        "redZoneLocation": "Ground Floor, West Wing, Direct Ambulance Ramp"
    })

# ----------------- 13. Admin & Cybersecurity Monitor -----------------
@app.route("/api/admin/metrics", methods=["GET"])
@require_auth(roles=["admin"])
def get_admin_metrics():
    return jsonify({
        "totalPatients": get_collection("users").count_documents({"role": "patient"}),
        "activeDoctors": get_collection("doctors").count_documents({"status": "active"}),
        "confirmedAppointments": get_collection("appointments").count_documents({"status": "confirmed"}),
        "tokensWaiting": get_collection("tokens").count_documents({"status": "waiting"}),
        "tokensServed": get_collection("tokens").count_documents({"status": "served"}),
        "pendingLabTests": get_collection("labOrders").count_documents({"status": {"$ne": "report_ready"}}),
        "pendingPrescriptions": get_collection("pharmacyOrders").count_documents({"status": "pending"}),
        "bloodUnitsAvailable": sum(item.get("unitsAvailable", 0) for item in get_collection("bloodInventory").find()),
        "securityAlertsCount": get_collection("securityEvents").count_documents()
    })

@app.route("/api/admin/audit-logs", methods=["GET"])
@require_auth(roles=["admin"])
def get_audit_logs():
    logs = get_collection("auditLogs").find()
    logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return jsonify(logs[:50])

@app.route("/api/admin/security-events", methods=["GET"])
@require_auth(roles=["admin"])
def get_security_events():
    events = get_collection("securityEvents").find()
    events.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return jsonify(events[:50])

@app.route("/api/admin/users", methods=["GET"])
@require_auth(roles=["admin"])
def get_all_users():
    users = get_collection("users").find()
    safe_users = [{k: v for k, v in u.items() if k != "passwordHash"} for u in users]
    return jsonify(safe_users)


if __name__ == "__main__":
    print("=========================================================")
    print(" QueueSeva Healthcare & Queue Management Server Starting ")
    print(" Open in Browser: http://127.0.0.1:5000                   ")
    print("=========================================================")
    app.run(host="0.0.0.0", port=5000, debug=True)
