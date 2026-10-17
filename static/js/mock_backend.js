/**
 * QueueSeva Client-Side Static Mock Interceptor
 * Activates when running on static hosts like GitHub Pages or when backend is unreachable,
 * ensuring all features work live in the browser without server errors.
 */

(function () {
    const isGitHubPages = window.location.hostname.includes("github.io") || window.location.protocol === "file:";

    const realFetch = window.fetch;

    // Seed data stored in localStorage for GitHub Pages live demo
    const DEFAULT_STORE = {
        queues: [
            { departmentId: "dept_gen_med", departmentName: "General Medicine", currentToken: "OPD-012", servingDoctor: "Dr. Aarav Mehta", room: "OPD Room 3", status: "active", waitingCount: 4, avgWaitMins: 15 },
            { departmentId: "dept_cardio", departmentName: "Cardiology", currentToken: "CARD-005", servingDoctor: "Dr. Ananya Roy", room: "Room 102", status: "active", waitingCount: 2, avgWaitMins: 20 },
            { departmentId: "lab", departmentName: "Pathology Laboratory", currentToken: "LAB-008", servingDoctor: "Priya Sharma", room: "Sample Counter 3", status: "active", waitingCount: 3, avgWaitMins: 8 },
            { departmentId: "pharmacy", departmentName: "Pharmacy Dispensary", currentToken: "PHARM-015", servingDoctor: "Vikram Desai", room: "Dispensing Counter 2", status: "active", waitingCount: 5, avgWaitMins: 6 }
        ],
        tokens: [
            { tokenNumber: "OPD-010", patientName: "Kantilal Shah", patientPhone: "9825100001", departmentId: "dept_gen_med", status: "served", priority: "normal", serviceCounter: "OPD Room 3" },
            { tokenNumber: "OPD-011", patientName: "Fatima Bi", patientPhone: "9825100002", departmentId: "dept_gen_med", status: "served", priority: "normal", serviceCounter: "OPD Room 3" },
            { tokenNumber: "OPD-012", patientName: "Ramesh Patel", patientPhone: "9876543210", departmentId: "dept_gen_med", status: "in_consultation", priority: "normal", serviceCounter: "OPD Room 3" },
            { tokenNumber: "OPD-013", patientName: "Dinesh Solanki", patientPhone: "9825100003", departmentId: "dept_gen_med", status: "waiting", priority: "normal", serviceCounter: "OPD Room 3" },
            { tokenNumber: "OPD-014", patientName: "Meena Dave", patientPhone: "9825100004", departmentId: "dept_gen_med", status: "waiting", priority: "urgent", serviceCounter: "OPD Room 3" }
        ],
        appointments: [
            {
                appointmentId: "QS-APT-90412",
                patientId: "usr_patient_1",
                patientName: "Ramesh Patel",
                departmentName: "General Medicine",
                doctorName: "Dr. Aarav Mehta",
                roomNumber: "OPD Room 3",
                date: new Date().toISOString().split("T")[0],
                arrivalWindow: "9:45 AM – 9:55 AM",
                slotTime: "10:00 AM",
                status: "confirmed"
            }
        ],
        departments: [
            { _id: "dept_gen_med", name: "General Medicine", code: "MED", floor: "Ground Floor", wing: "Wing A", fee: 50 },
            { _id: "dept_cardio", name: "Cardiology", code: "CARD", floor: "1st Floor", wing: "Wing B", fee: 100 },
            { _id: "dept_ortho", name: "Orthopedics", code: "ORTH", floor: "Ground Floor", wing: "Wing C", fee: 80 },
            { _id: "dept_pedia", name: "Pediatrics", code: "PED", floor: "2nd Floor", wing: "Wing A", fee: 50 },
            { _id: "dept_gynec", name: "Gynecology & Obstetrics", code: "GYN", floor: "1st Floor", wing: "Wing C", fee: 60 }
        ],
        doctors: [
            { _id: "doc_aarav", name: "Dr. Aarav Mehta", departmentId: "dept_gen_med", departmentName: "General Medicine", roomNumber: "OPD Room 3", consultationStatus: "busy", currentPatient: { tokenNumber: "OPD-012", patientName: "Ramesh Patel", patientPhone: "9876543210" } },
            { _id: "doc_bhavik", name: "Dr. Bhavik Solanki", departmentId: "dept_ortho", departmentName: "Orthopedics", roomNumber: "OPD Room 8", consultationStatus: "free", currentPatient: null },
            { _id: "doc_ananya", name: "Dr. Ananya Roy", departmentId: "dept_cardio", departmentName: "Cardiology", roomNumber: "Room 102", consultationStatus: "free", currentPatient: null }
        ],
        consultedPatients: [
            { tokenNumber: "OPD-010", patientName: "Kantilal Shah", doctorName: "Dr. Aarav Mehta", roomNumber: "OPD Room 3", completedAt: "10:15 AM", status: "Consulted & Free" },
            { tokenNumber: "OPD-011", patientName: "Fatima Bi", doctorName: "Dr. Aarav Mehta", roomNumber: "OPD Room 3", completedAt: "10:35 AM", status: "Consulted & Free" }
        ],
        locations: [
            { id: "loc_entrance", name: "Main Hospital Gate & Reception", type: "entrance", x: 125, y: 415, floor: "Ground Floor", desc: "Information desk, wheelchair assistance & triage." },
            { id: "loc_reg", name: "Registration & Check-In Counter", type: "counter", x: 270, y: 380, floor: "Ground Floor", desc: "Counter 1-4 for walk-in slips and appointment check-in." },
            { id: "loc_opd_med", name: "OPD Room 3 (General Medicine)", type: "doctor_room", x: 385, y: 280, floor: "Ground Floor", desc: "Dr. Aarav Mehta consulting room & waiting lounge." },
            { id: "loc_opd_ortho", name: "OPD Room 8 (Orthopedics)", type: "doctor_room", x: 515, y: 280, floor: "Ground Floor", desc: "Dr. Bhavik Solanki consultation & plaster room." },
            { id: "loc_lab", name: "Central Pathology Laboratory", type: "laboratory", x: 390, y: 100, floor: "Ground Floor", desc: "Sample collection counters 1-6 and report dispatch." },
            { id: "loc_pharmacy", name: "Jan Aushadhi Pharmacy", type: "pharmacy", x: 240, y: 200, floor: "Ground Floor", desc: "Medicine collection counters 1-4 with digital queue display." },
            { id: "loc_bloodbank", name: "Regional Blood Bank & Transfusion", type: "blood_bank", x: 530, y: 100, floor: "Ground Floor", desc: "Blood matching, storage and donation donor unit." },
            { id: "loc_billing", name: "Central Billing & Concession Desk", type: "billing", x: 240, y: 290, floor: "Ground Floor", desc: "Cash receipts, PM-JAY and digital UPI counter." },
            { id: "loc_emergency", name: "Emergency & Trauma Red Zone", type: "emergency", x: 100, y: 140, floor: "Ground Floor", desc: "24/7 dedicated ambulance bay and trauma center." },
            { id: "loc_lift", name: "Central Lifts & Disability Ramp", type: "accessibility", x: 300, y: 220, floor: "Ground Floor", desc: "Braille-assisted lifts and wide ramp connecting Floor 1 & 2." }
        ],
        transport: [
            { id: "tr_bus_1", type: "Bus", name: "Civil Hospital Main Gate Bus Stop", distance: "50m (1 min walk)", routes: "AMTS Routes: 40/1, 58, 66, 102", freq: "Every 5 mins" },
            { id: "tr_metro_1", type: "Metro", name: "Civil Hospital Metro Station (North-South)", distance: "220m (3 min walk)", routes: "Platform 1 & 2 toward APMC / Motera", freq: "Every 8 mins" },
            { id: "tr_auto_1", type: "Auto-Rickshaw", name: "Designated Prepaid Auto Stand", distance: "80m", routes: "Authorized meter stands with RTO kiosk", freq: "24/7 Available" },
            { id: "tr_parking_1", type: "Parking", name: "Patient Multilevel Parking (P2)", distance: "120m", routes: "Free 2-wheeler and subsidized 4-wheeler parking", freq: "Open 24 Hours" }
        ],
        medicines: [
            { _id: "med_pcm", name: "Paracetamol 500mg Tablets", generic: "Paracetamol", stock: 850, unit: "Tablets", price: 12.0, status: "In Stock" },
            { _id: "med_amox", name: "Amoxicillin 500mg Capsules", generic: "Amoxicillin", stock: 320, unit: "Capsules", price: 45.0, status: "In Stock" },
            { _id: "med_cet", name: "Cetirizine 10mg Tablets", generic: "Cetirizine HCl", stock: 640, unit: "Tablets", price: 15.0, status: "In Stock" },
            { _id: "med_panto", name: "Pantoprazole 40mg", generic: "Pantoprazole", stock: 450, unit: "Tablets", price: 38.0, status: "In Stock" }
        ],
        blood: [
            { group: "A+", component: "Whole Blood / PRBC", unitsAvailable: 24, status: "Available" },
            { group: "A-", component: "Whole Blood / PRBC", unitsAvailable: 6, status: "Critical" },
            { group: "B+", component: "Whole Blood / PRBC", unitsAvailable: 32, status: "Available" },
            { group: "O+", component: "Whole Blood / PRBC", unitsAvailable: 45, status: "Available" },
            { group: "O-", component: "Whole Blood (Universal Donor)", unitsAvailable: 4, status: "Emergency Reserve" },
            { group: "AB+", component: "Whole Blood / PRBC", unitsAvailable: 14, status: "Available" }
        ],
        labOrders: [
            { _id: "lab_01", testName: "Complete Blood Count (CBC)", patientName: "Ramesh Patel", status: "collected", price: 100 },
            { _id: "lab_02", testName: "Liver Function Test (LFT)", patientName: "Meena Dave", status: "pending_collection", price: 180 }
        ],
        pharmacyOrders: [
            { _id: "pharm_01", prescriptionId: "QS-RX-8812", patientName: "Ramesh Patel", medicines: [{ name: "Paracetamol 500mg" }, { name: "Pantoprazole 40mg" }], status: "pending" }
        ],
        bloodRequests: [
            { _id: "br_01", group: "O+", units: 2, patientName: "Emergency Bay Patient", urgency: "Urgent", status: "requested" }
        ],
        bills: [
            {
                _id: "b_01", invoiceNumber: "QS-INV-2026-0891", patientName: "Ramesh Patel", total: 162.0, status: "pending",
                items: [{ name: "OPD Consultation (General Medicine)", total: 50 }, { name: "Complete Blood Count (CBC)", total: 100 }, { name: "Paracetamol 500mg", total: 12 }]
            }
        ],
        auditLogs: [
            { timestamp: new Date().toISOString(), role: "PATIENT", action: "LOGIN_SUCCESS", username: "patient@queueseva.gov.in" },
            { timestamp: new Date().toISOString(), role: "DOCTOR", action: "CONSULTATION_STARTED", username: "doctor@queueseva.gov.in" }
        ],
        securityEvents: [
            { timestamp: new Date().toISOString(), severity: "LOW", eventType: "SESSION_VERIFIED", details: { client: "Browser" } }
        ]
    };

    function getStore() {
        const stored = localStorage.getItem("qs_mock_store");
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { }
        }
        localStorage.setItem("qs_mock_store", JSON.stringify(DEFAULT_STORE));
        return JSON.parse(JSON.stringify(DEFAULT_STORE));
    }

    function saveStore(store) {
        localStorage.setItem("qs_mock_store", JSON.stringify(store));
    }

    function mockResponse(data, status = 200) {
        return Promise.resolve(new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" }
        }));
    }

    // Intercept fetch calls
    window.fetch = async function (url, options = {}) {
        if (typeof url === "string" && url.startsWith("/api/")) {
            // If on localhost with python server running, try real fetch first
            if (!isGitHubPages) {
                try {
                    const res = await realFetch(url, options);
                    if (res.status !== 404 && res.status !== 502) return res;
                } catch (err) {
                    // Fall through to mock
                }
            }

            const store = getStore();
            const method = (options.method || "GET").toUpperCase();
            let body = {};
            if (options.body) {
                try { body = JSON.parse(options.body); } catch (e) { }
            }

            // Route matching
            if (url.includes("/api/auth/me")) {
                const token = options.headers && options.headers.Authorization;
                if (!token) return mockResponse({ user: null });
                return mockResponse({
                    user: {
                        name: "Ramesh Patel",
                        email: "patient@queueseva.gov.in",
                        role: "patient",
                        phone: "+91 98765 43210",
                        allergies: ["Penicillin", "Sulfa"]
                    }
                });
            }

            if (url.includes("/api/auth/login")) {
                const email = body.email || "";
                let role = "patient";
                let name = "Ramesh Patel";
                if (email.includes("doctor")) { role = "doctor"; name = "Dr. Aarav Mehta"; }
                else if (email.includes("staff")) { role = "staff"; name = "Sunil Joshi"; }
                else if (email.includes("lab")) { role = "lab"; name = "Priya Sharma"; }
                else if (email.includes("pharmacy")) { role = "pharmacy"; name = "Vikram Desai"; }
                else if (email.includes("blood")) { role = "bloodbank"; name = "Dr. Neha Shah"; }
                else if (email.includes("admin")) { role = "admin"; name = "H. M. Trivedi"; }

                return mockResponse({
                    message: "Login successful.",
                    token: "mock-session-" + role,
                    user: { name, email, role, phone: "+91 98765 43210" }
                });
            }

            if (url.includes("/api/departments")) return mockResponse(store.departments);
            if (url.includes("/api/navigation/locations")) return mockResponse(store.locations);
            if (url.includes("/api/navigation/transport")) return mockResponse(store.transport);
            if (url.includes("/api/pharmacy/medicines")) return mockResponse(store.medicines);
            if (url.includes("/api/bloodbank/inventory")) return mockResponse(store.blood);

            if (url.includes("/api/queue/live")) {
                return mockResponse({
                    queues: store.queues,
                    userActiveToken: store.tokens.find(t => t.status === "in_consultation" || t.status === "waiting")
                });
            }

            if (url.includes("/api/recommend-appointment")) {
                return mockResponse({
                    status: "available",
                    message: "Optimal slot identified during your preferred window (9:00 AM – 10:00 AM).",
                    recommendedSlot: "9:30 AM",
                    recommendedArrivalWindow: "9:15 AM – 9:25 AM",
                    expectedWaitMins: 15,
                    doctorName: "Dr. Aarav Mehta",
                    departmentId: body.departmentId || "dept_gen_med",
                    roomNumber: "OPD Room 3",
                    alternatives: []
                });
            }

            if (url.includes("/api/appointments/book")) {
                const appt = {
                    appointmentId: "QS-APT-" + Math.floor(10000 + Math.random() * 90000),
                    departmentName: "General Medicine",
                    doctorName: "Dr. Aarav Mehta",
                    roomNumber: "OPD Room 3",
                    date: body.date || new Date().toISOString().split("T")[0],
                    arrivalWindow: body.arrivalWindow || "9:15 AM – 9:25 AM",
                    slotTime: body.slotTime || "9:30 AM",
                    status: "confirmed"
                };
                store.appointments.unshift(appt);
                saveStore(store);
                return mockResponse({ message: "Confirmed!", appointment: appt });
            }

            if (url.includes("/api/appointments/my")) return mockResponse(store.appointments);

            if (url.includes("/api/queue/checkin")) {
                const tNum = "OPD-" + Math.floor(10 + Math.random() * 80);
                const token = {
                    tokenNumber: tNum,
                    patientName: "Ramesh Patel",
                    status: "waiting",
                    serviceCounter: "OPD Room 3"
                };
                store.tokens.push(token);
                saveStore(store);
                return mockResponse({ message: "Checked in", token });
            }

            if (url.includes("/api/geofence/arrival")) {
                return mockResponse({
                    insideGeofence: true,
                    distanceMeters: body.distanceMeters || 110,
                    message: "Welcome to QueueSeva! Your arrival has been detected near the hospital entrance. Please confirm check-in to receive your digital token."
                });
            }

            if (url.includes("/api/doctors/status")) {
                return mockResponse(store.doctors || []);
            }

            if (url.includes("/api/staff/process-to-doctor")) {
                const docId = body.doctorId || "doc_aarav";
                const doc = (store.doctors || []).find(d => d._id === docId) || store.doctors[0];
                let token = null;

                if (body.tokenNumber) {
                    token = store.tokens.find(t => t.tokenNumber === body.tokenNumber);
                } else {
                    token = store.tokens.find(t => t.departmentId === doc.departmentId && t.status === "waiting");
                }

                if (!token) {
                    return mockResponse({ error: "No waiting patients found for this department." }, 400);
                }

                token.status = "in_consultation";
                token.serviceCounter = doc.roomNumber;
                doc.consultationStatus = "busy";
                doc.currentPatient = token;
                saveStore(store);

                const lang = body.language || "en";
                let announcement = `Token number ${token.tokenNumber}, please proceed to ${doc.roomNumber} for consultation with ${doc.name}.`;
                if (lang === "hi") {
                    announcement = `टोकन नंबर ${token.tokenNumber}, कृपया ${doc.roomNumber} में पधारें।`;
                } else if (lang === "gu") {
                    announcement = `ટોકન નંબર ${token.tokenNumber}, કૃપા કરીને ${doc.roomNumber} માં જાવ.`;
                }

                return mockResponse({
                    message: `Token ${token.tokenNumber} sent to ${doc.name} (${doc.roomNumber})`,
                    announcementText: announcement,
                    token,
                    doctor: doc
                });
            }

            if (url.includes("/api/doctor/queue")) {
                const doc = (store.doctors || []).find(d => d.consultationStatus === "busy");
                return mockResponse({
                    queue: store.tokens.filter(t => t.status === "waiting" || t.status === "in_consultation"),
                    currentPatient: (doc && doc.currentPatient) || store.tokens.find(t => t.status === "in_consultation") || null
                });
            }

            if (url.includes("/api/doctor/consultation/call-next")) {
                const nextT = store.tokens.find(t => t.status === "waiting") || store.tokens[0];
                const doc = (store.doctors || [])[0];
                if (nextT) {
                    nextT.status = "in_consultation";
                    if (doc) {
                        doc.consultationStatus = "busy";
                        doc.currentPatient = nextT;
                    }
                }
                saveStore(store);
                return mockResponse({
                    message: "Called",
                    token: nextT,
                    announcementText: `Token number ${nextT ? nextT.tokenNumber : '---'}, please proceed to OPD Room 3.`
                });
            }

            if (url.includes("/api/doctor/consultation/finish")) {
                const tokenNum = body.tokenNumber || "OPD-012";
                const token = store.tokens.find(t => t.tokenNumber === tokenNum);
                const doc = (store.doctors || [])[0];

                if (token) {
                    token.status = "served";
                    token.completedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

                if (doc) {
                    doc.consultationStatus = "free";
                    doc.currentPatient = null;
                }

                if (!store.consultedPatients) store.consultedPatients = [];
                store.consultedPatients.unshift({
                    tokenNumber: tokenNum,
                    patientName: token ? token.patientName : "Consulted Citizen",
                    doctorName: doc ? doc.name : "Dr. Aarav Mehta",
                    roomNumber: doc ? doc.roomNumber : "OPD Room 3",
                    completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: "Consulted & Free"
                });

                saveStore(store);
                return mockResponse({
                    message: "Consultation finalized, patient removed from queue, doctor is now FREE!",
                    prescription: { id: "QS-RX-" + Math.floor(1000 + Math.random() * 9000) }
                });
            }

            if (url.includes("/api/doctor/consulted-today")) {
                return mockResponse(store.consultedPatients || []);
            }

            if (url.includes("/api/staff/walkin-token")) {
                const tNum = "OPD-" + Math.floor(15 + Math.random() * 50);
                const tok = { tokenNumber: tNum, patientName: body.name || "Walk-in Citizen", status: "waiting", priority: body.priority || "normal" };
                store.tokens.push(tok);
                saveStore(store);
                return mockResponse({ message: "Token issued", token: tok });
            }

            if (url.includes("/api/staff/call-token")) {
                const t = body.tokenNumber || "OPD-012";
                return mockResponse({
                    message: "Called",
                    announcementText: `Token number ${t}, please proceed to OPD Room 3.`
                });
            }

            if (url.includes("/api/staff/pause-queue")) {
                return mockResponse({ message: "Queue status toggled.", status: body.action === "pause" ? "paused" : "active" });
            }

            if (url.includes("/api/lab/orders/update-status")) {
                return mockResponse({ message: "Lab order status updated." });
            }

            if (url.includes("/api/lab/orders")) return mockResponse(store.labOrders);
            if (url.includes("/api/pharmacy/orders")) return mockResponse(store.pharmacyOrders);
            if (url.includes("/api/pharmacy/dispense")) return mockResponse({ message: "Dispensed" });
            if (url.includes("/api/bloodbank/requests")) return mockResponse(store.bloodRequests);
            if (url.includes("/api/bloodbank/request/update")) return mockResponse({ message: "Updated" });
            if (url.includes("/api/billing/bills")) return mockResponse(store.bills);

            if (url.includes("/api/billing/pay")) {
                return mockResponse({ message: "Paid", receiptNo: "REC-QS-" + Math.floor(1000 + Math.random() * 9000) });
            }

            if (url.includes("/api/emergency/assist")) {
                return mockResponse({
                    status: "ACTIVE_EMERGENCY_DISPATCH",
                    instructions: "Do not wait for an online appointment. Proceed directly to Emergency Red Zone Gate 1.",
                    hospitalEmergencyHotline: "+91 79 2268 0000 / 108 Ambulance",
                    traumaDutyOfficer: "Dr. Sandeep Patel (Emergency Triage Head)",
                    redZoneLocation: "Ground Floor, West Wing, Direct Ambulance Ramp"
                });
            }

            if (url.includes("/api/admin/metrics")) {
                return mockResponse({
                    totalPatients: 148,
                    activeDoctors: 8,
                    confirmedAppointments: 24,
                    tokensWaiting: store.tokens.filter(t => t.status === "waiting").length,
                    tokensServed: 32,
                    pendingLabTests: 4,
                    securityAlertsCount: 2
                });
            }

            if (url.includes("/api/admin/audit-logs")) return mockResponse(store.auditLogs);
            if (url.includes("/api/admin/security-events")) return mockResponse(store.securityEvents);

            return mockResponse({ message: "OK" });
        }

        return realFetch(url, options);
    };
})();
