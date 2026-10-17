/**
 * QueueSeva - Main Client Application Controller
 * Handles Multi-Role Workflows, Smart Scheduling, Live Queues, and Security
 */

const App = {
    currentUser: null,
    currentRole: "patient",
    authToken: localStorage.getItem("queuseva_token") || null,
    activeAppointment: null,
    pollInterval: null,

    init: async function () {
        // Setup accessibility toggles
        const accToggle = document.getElementById("toggleAccessibility");
        if (accToggle) {
            accToggle.addEventListener("change", (e) => {
                document.body.classList.toggle("accessibility-mode", e.target.checked);
            });
        }

        const contrastToggle = document.getElementById("toggleContrast");
        if (contrastToggle) {
            contrastToggle.addEventListener("change", (e) => {
                document.body.classList.toggle("high-contrast", e.target.checked);
            });
        }

        // Initialize i18n
        setLanguage(currentLanguage);

        // Check authentication
        await this.checkAuth();

        // Initialize Navigation & Geofence
        HospitalNavigator.init();
        GeofenceDetector.init();

        // Start Live Queue Poller (every 6 seconds)
        this.fetchLiveQueues();
        this.pollInterval = setInterval(() => this.fetchLiveQueues(), 6000);

        // Load reference data
        this.loadDepartments();
    },

    toast: function (message, type = "info") {
        const container = document.getElementById("toastContainer");
        if (!container) return;
        const toast = document.createElement("div");
        toast.className = "toast";
        if (type === "success") toast.style.borderLeft = "4px solid #16a34a";
        if (type === "error") toast.style.borderLeft = "4px solid #dc2626";
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    // ----------------- Authentication & Login Portal -----------------
    checkAuth: async function () {
        if (!this.authToken) {
            this.showLoginScreen();
            return;
        }
        try {
            const res = await fetch("/api/auth/me", {
                headers: { "Authorization": `Bearer ${this.authToken}` }
            });
            const data = await res.json();
            if (data && data.user) {
                this.currentUser = data.user;
                this.currentRole = data.user.role;
                this.updateAuthUI();
                this.hideLoginScreen();
                this.switchRole(data.user.role);
            } else {
                this.showLoginScreen();
            }
        } catch (e) {
            this.showLoginScreen();
        }
    },

    showLoginScreen: function () {
        this.currentUser = null;
        this.authToken = null;
        localStorage.removeItem("queuseva_token");
        
        // Hide all dashboard views
        document.querySelectorAll(".dashboard-view").forEach(v => v.style.display = "none");
        
        // Show login view
        const loginView = document.getElementById("view_login");
        if (loginView) loginView.style.display = "block";

        const ribbon = document.querySelector(".role-ribbon");
        if (ribbon) ribbon.style.display = "none";

        const ticker = document.querySelector(".token-ticker-card");
        if (ticker) ticker.style.display = "none";

        const geofence = document.getElementById("geofenceStatusBox");
        if (geofence) geofence.style.display = "none";

        this.updateAuthUI();
    },

    hideLoginScreen: function () {
        const loginView = document.getElementById("view_login");
        if (loginView) loginView.style.display = "none";

        const ribbon = document.querySelector(".role-ribbon");
        if (ribbon) ribbon.style.display = "flex";

        const ticker = document.querySelector(".token-ticker-card");
        if (ticker) ticker.style.display = "flex";

        const geofence = document.getElementById("geofenceStatusBox");
        if (geofence) geofence.style.display = "block";
    },

    selectLoginRole: function (role, el) {
        document.querySelectorAll(".login-role-chip").forEach(c => c.classList.remove("selected"));
        if (el) el.classList.add("selected");
        const emailMap = {
            patient: "patient@queueseva.gov.in",
            doctor: "doctor@queueseva.gov.in",
            staff: "staff@queueseva.gov.in",
            lab: "lab@queueseva.gov.in",
            pharmacy: "pharmacy@queueseva.gov.in",
            bloodbank: "bloodbank@queueseva.gov.in",
            admin: "admin@queueseva.gov.in"
        };
        const passMap = {
            patient: "patient123",
            doctor: "doctor123",
            staff: "staff123",
            lab: "lab123",
            pharmacy: "pharmacy123",
            bloodbank: "blood123",
            admin: "admin123"
        };
        const emailInput = document.getElementById("loginEmailInput");
        const passInput = document.getElementById("loginPasswordInput");
        if (emailInput && emailMap[role]) emailInput.value = emailMap[role];
        if (passInput && passMap[role]) passInput.value = passMap[role];
    },

    loginFormSubmit: async function (e) {
        if (e) e.preventDefault();
        const email = (document.getElementById("loginEmailInput") ? document.getElementById("loginEmailInput").value : "").trim();
        const pass = document.getElementById("loginPasswordInput") ? document.getElementById("loginPasswordInput").value : "";

        if (!email || !pass) {
            this.toast("Please enter email address and password", "error");
            return;
        }

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password: pass })
            });
            const data = await res.json();
            if (data.token) {
                this.authToken = data.token;
                localStorage.setItem("queuseva_token", data.token);
                this.currentUser = data.user;
                this.currentRole = data.user.role;
                this.updateAuthUI();
                this.hideLoginScreen();
                this.switchRole(data.user.role);
                this.toast(`Welcome back, ${data.user.name}!`, "success");
            } else {
                this.toast(data.error || "Login credentials failed", "error");
            }
        } catch (err) {
            this.toast("Login error", "error");
        }
    },

    quickLoginAs: async function (role) {
        const credentials = {
            patient: { email: "patient@queueseva.gov.in", pass: "patient123" },
            doctor: { email: "doctor@queueseva.gov.in", pass: "doctor123" },
            staff: { email: "staff@queueseva.gov.in", pass: "staff123" },
            lab: { email: "lab@queueseva.gov.in", pass: "lab123" },
            pharmacy: { email: "pharmacy@queueseva.gov.in", pass: "pharmacy123" },
            bloodbank: { email: "bloodbank@queueseva.gov.in", pass: "blood123" },
            admin: { email: "admin@queueseva.gov.in", pass: "admin123" }
        };

        const cred = credentials[role];
        if (!cred) return;

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: cred.email, password: cred.pass })
            });
            const data = await res.json();
            if (data.token) {
                this.authToken = data.token;
                localStorage.setItem("queuseva_token", data.token);
                this.currentUser = data.user;
                this.currentRole = data.user.role;
                this.updateAuthUI();
                this.hideLoginScreen();
                this.switchRole(this.currentRole);
                this.toast(`Authenticated as ${data.user.name} (${data.user.role.toUpperCase()})`, "success");
            } else {
                this.toast(data.error || "Login failed", "error");
            }
        } catch (e) {
            this.toast("Server login error", "error");
        }
    },

    logout: async function () {
        if (this.authToken) {
            await fetch("/api/auth/logout", {
                method: "POST",
                headers: { "Authorization": `Bearer ${this.authToken}` }
            });
        }
        this.authToken = null;
        this.currentUser = null;
        localStorage.removeItem("queuseva_token");
        this.showLoginScreen();
        this.toast("Logged out successfully");
    },

    updateAuthUI: function () {
        const userDisplay = document.getElementById("currentUserDisplay");
        if (userDisplay) {
            if (this.currentUser) {
                userDisplay.innerHTML = `
                    <div style="font-size: 0.85rem; text-align: right; display: flex; align-items: center; gap: 8px;">
                        <div>
                            <strong>${this.currentUser.name}</strong> 
                            <span class="badge badge-info">${this.currentUser.role.toUpperCase()}</span>
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="App.logout()">Sign Out</button>
                    </div>
                `;
            } else {
                userDisplay.innerHTML = `<button class="btn btn-sm btn-primary" onclick="App.showLoginScreen()">Login Portal</button>`;
            }
        }
    },

    switchRole: function (role) {
        this.currentRole = role;
        document.querySelectorAll(".role-tab").forEach(tab => {
            tab.classList.toggle("active", tab.getAttribute("data-role") === role);
        });

        // Hide all dashboard views
        document.querySelectorAll(".dashboard-view").forEach(v => v.style.display = "none");

        // Show target view
        const targetView = document.getElementById(`view_${role}`);
        if (targetView) targetView.style.display = "block";

        // Refresh view data
        if (role === "patient") this.loadPatientDashboard();
        if (role === "doctor") this.loadDoctorDashboard();
        if (role === "staff") this.loadStaffDashboard();
        if (role === "lab") this.loadLabDashboard();
        if (role === "pharmacy") this.loadPharmacyDashboard();
        if (role === "bloodbank") this.loadBloodBankDashboard();
        if (role === "admin") this.loadAdminDashboard();
    },

    // ----------------- Live Queue Monitor -----------------
    fetchLiveQueues: async function () {
        try {
            const res = await fetch("/api/queue/live", {
                headers: this.authToken ? { "Authorization": `Bearer ${this.authToken}` } : {}
            });
            const data = await res.json();

            // Update ticker
            const medQueue = data.queues.find(q => q.departmentId === "dept_gen_med") || data.queues[0];
            if (medQueue) {
                const currentEl = document.getElementById("liveCurrentToken");
                const waitEl = document.getElementById("liveQueueWaiting");
                const pauseBadge = document.getElementById("queuePauseBadge");

                if (currentEl) currentEl.innerText = medQueue.currentToken || "---";
                if (waitEl) waitEl.innerText = `${medQueue.waitingCount || 0} Patients`;

                if (pauseBadge) {
                    if (medQueue.status === "paused") {
                        pauseBadge.style.display = "inline-flex";
                        pauseBadge.innerText = `⏸ PAUSED: ${medQueue.pauseReason || 'Break'}`;
                    } else {
                        pauseBadge.style.display = "none";
                    }
                }
            }

            // Update patient active token badge if present
            const myTokenBox = document.getElementById("patientActiveTokenBox");
            if (myTokenBox) {
                if (data.userActiveToken) {
                    myTokenBox.style.display = "block";
                    myTokenBox.innerHTML = `
                        <div style="background: #ffffff; border: 2px solid #0284c7; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <span style="font-size: 0.8rem; color: #64748b;">YOUR ACTIVE TOKEN:</span>
                                    <h3 style="color: #0284c7; font-size: 1.6rem; font-weight: 800;">${data.userActiveToken.tokenNumber}</h3>
                                    <div style="font-size: 0.85rem; color: #0f172a;">Assigned: <strong>${data.userActiveToken.serviceCounter || 'Room 3'}</strong></div>
                                </div>
                                <div style="text-align: right;">
                                    <span class="badge ${data.userActiveToken.status === 'in_consultation' ? 'badge-danger' : 'badge-success'}">
                                        ${data.userActiveToken.status.toUpperCase()}
                                    </span>
                                    <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">Approx Wait: ~15 mins</div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    myTokenBox.style.display = "none";
                }
            }
        } catch (e) {
            console.error("Queue fetch error:", e);
        }
    },

    // ----------------- Smart Appointment Flow -----------------
    loadDepartments: async function () {
        try {
            const res = await fetch("/api/departments");
            const depts = await res.json();
            const select = document.getElementById("bookingDeptSelect");
            if (select) {
                select.innerHTML = depts.map(d => `<option value="${d._id}">${d.name} (${d.wing}, ${d.floor}) - Fee: ₹${d.fee}</option>`).join("");
            }
        } catch (e) {
            console.error("Dept load error:", e);
        }
    },

    requestSmartRecommendation: async function () {
        const date = document.getElementById("bookingDateInput").value;
        const timeRangeKey = document.getElementById("bookingTimeRangeSelect").value;
        const deptId = document.getElementById("bookingDeptSelect").value;
        const hasAccessibility = document.getElementById("bookingAccessibilityCheck").checked;

        try {
            const res = await fetch("/api/recommend-appointment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: date || new Date().toISOString().split("T")[0],
                    timeRangeKey,
                    departmentId: deptId,
                    hasAccessibilityNeed: hasAccessibility
                })
            });
            const data = await res.json();

            const recBox = document.getElementById("recommendationResultBox");
            if (recBox) {
                recBox.style.display = "block";
                let alternativesHtml = "";
                if (data.alternatives && data.alternatives.length > 0) {
                    alternativesHtml = `
                        <div style="margin-top: 12px;">
                            <strong style="color: #b45309;">Nearest Alternative Available Windows:</strong>
                            ${data.alternatives.map(alt => `
                                <div class="alt-slot-item">
                                    <div>
                                        <strong>${alt.label}</strong> (Arrival Window: ${alt.arrivalWindow})
                                    </div>
                                    <button class="btn btn-sm btn-secondary" onclick="App.confirmBooking('${alt.recommendedSlot}', '${alt.arrivalWindow}')">Choose this</button>
                                </div>
                            `).join("")}
                        </div>
                    `;
                }

                recBox.innerHTML = `
                    <div class="recommendation-box">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <h4 style="color: #1e40af; margin-bottom: 4px;">🎯 Smart Appointment Recommendation</h4>
                                <p style="font-size: 0.9rem; color: #3b82f6;">${data.message}</p>
                            </div>
                            <span class="badge ${data.status === 'available' ? 'badge-success' : 'badge-warning'}">
                                ${data.status === 'available' ? 'Available' : 'Congestion Avoided'}
                            </span>
                        </div>
                        <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.95rem;">
                            <div><strong>Suggested Arrival Window:</strong> <span style="color:#0284c7; font-weight:700;">${data.recommendedArrivalWindow}</span></div>
                            <div><strong>Appointment Slot:</strong> ${data.recommendedSlot}</div>
                            <div><strong>Doctor:</strong> ${data.doctorName} (${data.roomNumber})</div>
                            <div><strong>Expected Wait Time:</strong> ~${data.expectedWaitMins} mins</div>
                        </div>
                        <div style="margin-top: 14px; display: flex; gap: 10px;">
                            <button class="btn btn-primary" onclick="App.confirmBooking('${data.recommendedSlot}', '${data.recommendedArrivalWindow}')">Confirm Appointment</button>
                            <button class="btn btn-secondary" onclick="document.getElementById('recommendationResultBox').style.display='none'">Change Preferences</button>
                        </div>
                        ${alternativesHtml}
                    </div>
                `;
            }
        } catch (e) {
            this.toast("Failed to compute smart recommendation", "error");
        }
    },

    confirmBooking: async function (slotTime, arrivalWindow) {
        if (!this.currentUser) {
            this.toast("Logging in with demo patient account to complete booking...", "info");
            await this.quickLoginAs("patient");
        }

        const deptId = document.getElementById("bookingDeptSelect").value;
        const date = document.getElementById("bookingDateInput").value || new Date().toISOString().split("T")[0];

        try {
            const res = await fetch("/api/appointments/book", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    departmentId: deptId,
                    date,
                    slotTime,
                    arrivalWindow
                })
            });
            const data = await res.json();
            if (data.appointment) {
                this.toast("Appointment successfully booked!", "success");
                document.getElementById("recommendationResultBox").style.display = "none";
                this.loadPatientDashboard();
            } else {
                this.toast(data.error || "Booking failed", "error");
            }
        } catch (e) {
            this.toast("Booking error", "error");
        }
    },

    loadPatientDashboard: async function () {
        if (!this.authToken) return;
        try {
            // Load appointments
            const res = await fetch("/api/appointments/my", {
                headers: { "Authorization": `Bearer ${this.authToken}` }
            });
            const appts = await res.json();
            const listEl = document.getElementById("patientAppointmentsList");
            if (listEl) {
                if (appts.length === 0) {
                    listEl.innerHTML = `<p style="color: #64748b; font-size: 0.9rem;">No appointments booked yet. Use the smart booking form above!</p>`;
                } else {
                    listEl.innerHTML = appts.map(apt => `
                        <div class="digital-card">
                            <div class="digital-card-header">
                                <div>
                                    <strong style="color: #0284c7; font-size: 1.1rem;"># ${apt.appointmentId}</strong>
                                    <div style="font-size: 0.85rem; color: #475569;">${apt.departmentName} • ${apt.doctorName}</div>
                                </div>
                                <span class="badge ${apt.status === 'confirmed' ? 'badge-info' : apt.status === 'checked_in' ? 'badge-success' : 'badge-warning'}">
                                    ${apt.status.toUpperCase()}
                                </span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; font-size: 0.88rem;">
                                <div><strong>Date:</strong> ${apt.date}</div>
                                <div><strong>Arrival Window:</strong> ${apt.arrivalWindow}</div>
                                <div><strong>Consultation Slot:</strong> ${apt.slotTime}</div>
                                <div><strong>Room:</strong> ${apt.roomNumber}</div>
                            </div>
                            <div style="margin-top: 12px; display: flex; gap: 8px;">
                                ${apt.status === 'confirmed' ? `
                                    <button class="btn btn-sm btn-success" onclick="App.checkInAppointment('${apt.appointmentId}')">Check-In Now</button>
                                    <button class="btn btn-sm btn-danger" onclick="App.cancelAppointment('${apt.appointmentId}')">Cancel</button>
                                ` : ''}
                                <button class="btn btn-sm btn-secondary" onclick="HospitalNavigator.selectLocation('loc_opd_med')">View Room on Map</button>
                            </div>
                        </div>
                    `).join("");
                }
            }

            // Load Bills
            this.loadPatientBills();
            // Load Lab Orders
            this.loadPatientLabOrders();
        } catch (e) {
            console.error("Patient dash error:", e);
        }
    },

    checkInAppointment: async function (apptId) {
        try {
            const res = await fetch("/api/queue/checkin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ appointmentId: apptId })
            });
            const data = await res.json();
            if (data.token) {
                this.toast(`Check-in successful! Token: ${data.token.tokenNumber}`, "success");
                this.fetchLiveQueues();
                this.loadPatientDashboard();
            } else {
                this.toast(data.error || "Check-in failed", "error");
            }
        } catch (e) {
            this.toast("Check-in error", "error");
        }
    },

    confirmArrivalCheckin: function () {
        // Trigger check-in from GPS geofence banner
        const btn = document.querySelector("#patientAppointmentsList .btn-success");
        if (btn) btn.click();
        else this.toast("Arrival verified! Please use the check-in button below your appointment.", "info");
    },

    cancelAppointment: async function (apptId) {
        if (!confirm("Are you sure you want to cancel this appointment?")) return;
        try {
            const res = await fetch(`/api/appointments/${apptId}/cancel`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${this.authToken}` }
            });
            const data = await res.json();
            this.toast(data.message || "Appointment cancelled", "info");
            this.loadPatientDashboard();
        } catch (e) {
            this.toast("Cancel error", "error");
        }
    },

    // ----------------- Doctor Dashboard -----------------
    loadDoctorDashboard: async function () {
        if (!this.currentUser || this.currentUser.role !== "doctor") {
            await this.quickLoginAs("doctor");
        }
        try {
            const res = await fetch("/api/doctor/queue", {
                headers: { "Authorization": `Bearer ${this.authToken}` }
            });
            const data = await res.json();

            const currentBox = document.getElementById("doctorCurrentPatientBox");
            if (currentBox) {
                if (data.currentPatient) {
                    currentBox.innerHTML = `
                        <div style="background: #fff5f5; border: 2px solid #ef4444; border-radius: 8px; padding: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <div>
                                    <span class="status-pill-busy">🔴 BUSY (Consulting Patient)</span>
                                    <h3 style="color: #991b1b; font-size: 1.5rem; margin-top: 6px;">Token: ${data.currentPatient.tokenNumber}</h3>
                                    <div style="font-size: 0.95rem; font-weight: 600;">${data.currentPatient.patientName} (${data.currentPatient.patientPhone || 'Registered Citizen'})</div>
                                    <div style="font-size: 0.85rem; color: #475569; margin-top: 2px;">Assigned Room: <strong>${data.currentPatient.serviceCounter || 'OPD Room 3'}</strong></div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="background: #fee2e2; border: 1px solid #ef4444; color: #991b1b; padding: 6px 12px; border-radius: 6px; font-size: 0.82rem; font-weight: bold;">
                                        ⚠️ Recorded Allergies: Penicillin, Sulfa
                                    </div>
                                    <div style="margin-top: 8px; font-size: 0.82rem; color: #64748b;">
                                        Staff is notified that you are currently busy with this patient.
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    document.getElementById("doctorConsultationForm").style.display = "block";
                    document.getElementById("activeDoctorTokenInput").value = data.currentPatient.tokenNumber;
                } else {
                    currentBox.innerHTML = `
                        <div style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                            <div>
                                <span class="status-pill-free">🟢 FREE — Ready for Next Patient</span>
                                <h3 style="color: #166534; font-size: 1.25rem; margin-top: 6px;">Consultation Room is Currently Available</h3>
                                <p style="color: #15803d; font-size: 0.88rem; margin-top: 2px;">
                                    Front-desk staff can dispatch the next waiting token to your room, or you can call the next patient directly.
                                </p>
                            </div>
                            <button class="btn btn-primary" onclick="App.doctorCallNext()">
                                <span>Call Next Patient Directly</span> ➔
                            </button>
                        </div>
                    `;
                    document.getElementById("doctorConsultationForm").style.display = "none";
                }
            }

            const queueTable = document.getElementById("doctorQueueTableBody");
            if (queueTable) {
                queueTable.innerHTML = data.queue.map((t, idx) => `
                    <tr>
                        <td><strong>${idx + 1}</strong></td>
                        <td><span class="badge ${t.priority === 'urgent' ? 'badge-danger' : 'badge-info'}">${t.tokenNumber}</span></td>
                        <td>${t.patientName}</td>
                        <td>${t.status === 'in_consultation' ? '<span class="badge badge-warning">IN ROOM</span>' : '<span class="badge badge-info">WAITING</span>'}</td>
                        <td>${t.priority === 'urgent' ? '<strong style="color:red;">URGENT PRIORITY</strong>' : 'Normal'}</td>
                    </tr>
                `).join("");
            }

            // Load consulted history
            this.loadConsultedToday();
        } catch (e) {
            console.error("Doctor dash error:", e);
        }
    },

    doctorCallNext: async function () {
        try {
            const res = await fetch("/api/doctor/consultation/call-next", {
                method: "POST",
                headers: { "Authorization": `Bearer ${this.authToken}` }
            });
            const data = await res.json();
            if (data.token) {
                this.toast(`Called Token ${data.token.tokenNumber}`, "success");
                VoiceAnnouncer.speak(data.announcementText, currentLanguage);
                this.loadDoctorDashboard();
                this.fetchLiveQueues();
            } else {
                this.toast(data.message || "Queue empty", "info");
            }
        } catch (e) {
            this.toast("Doctor call error", "error");
        }
    },

    doctorFinishConsultation: async function () {
        const tokenNumber = document.getElementById("activeDoctorTokenInput").value;
        const notes = document.getElementById("doctorNotesInput").value;
        const med1 = document.getElementById("docRxMed1").value;
        const med2 = document.getElementById("docRxMed2").value;
        const labOrder = document.getElementById("docLabOrderSelect").value;
        const bloodNeed = document.getElementById("docBloodRequestCheck").checked;

        const medicines = [];
        if (med1) medicines.push({ name: med1, dosage: "1 Tablet Twice Daily", duration: "5 Days", price: 15 });
        if (med2) medicines.push({ name: med2, dosage: "1 Capsule Once Daily", duration: "3 Days", price: 45 });

        const labTests = [];
        if (labOrder) labTests.push({ id: "test_cbc", name: labOrder, price: 100 });

        const bloodRequest = bloodNeed ? { group: "O+", units: 1, urgency: "Urgent" } : null;

        try {
            const res = await fetch("/api/doctor/consultation/finish", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    tokenNumber,
                    notes,
                    medicines,
                    labTests,
                    bloodRequest,
                    followUpDays: 7
                })
            });
            const data = await res.json();
            if (data.prescription || data.message) {
                this.toast("Consultation finalized! Patient removed from room. Doctor is now FREE for the next patient.", "success");
                this.loadDoctorDashboard();
                this.fetchLiveQueues();
            } else {
                this.toast(data.error || "Save error", "error");
            }
        } catch (e) {
            this.toast("Consultation save error", "error");
        }
    },

    // ----------------- Staff Dashboard & Doctor Room Coordination -----------------
    loadStaffDashboard: async function () {
        if (!this.currentUser || this.currentUser.role !== "staff") {
            await this.quickLoginAs("staff");
        }
        this.fetchLiveQueues();
        this.loadDoctorRoomsStatus();
        this.loadConsultedToday();
    },

    loadDoctorRoomsStatus: async function () {
        try {
            const res = await fetch("/api/doctors/status");
            const doctors = await res.json();

            const container = document.getElementById("staffDoctorRoomsGrid");
            if (container) {
                container.innerHTML = doctors.map(doc => {
                    const isFree = doc.consultationStatus === "free";
                    return `
                        <div class="doctor-room-card ${isFree ? 'is-free' : 'is-busy'}">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <span class="${isFree ? 'status-pill-free' : 'status-pill-busy'}">
                                        ${isFree ? '🟢 FREE (Ready)' : '🔴 BUSY (Consulting)'}
                                    </span>
                                    <h4 style="margin-top: 8px; color: #0f172a; font-size: 1.1rem;">${doc.name}</h4>
                                    <div style="font-size: 0.85rem; color: #0284c7; font-weight: 600;">${doc.roomNumber || 'OPD Room'} • ${doc.departmentName || 'General OPD'}</div>
                                </div>
                            </div>
                            <div style="margin-top: 12px; font-size: 0.88rem; min-height: 44px;">
                                ${isFree ? `
                                    <div style="color: #16a34a; font-weight: 600;">
                                        ✓ Doctor is currently free. Ready to receive next token.
                                    </div>
                                ` : `
                                    <div style="color: #dc2626;">
                                        <strong>Currently Consulting:</strong> ${doc.currentPatient ? doc.currentPatient.tokenNumber : 'Patient'} (${doc.currentPatient ? doc.currentPatient.patientName : ''})
                                    </div>
                                `}
                            </div>
                            <div style="margin-top: 12px;">
                                ${isFree ? `
                                    <button class="btn btn-sm btn-success" style="width: 100%;" onclick="App.staffProcessToDoctor('${doc._id}')">
                                        👉 Send Next Waiting Patient to Room
                                    </button>
                                ` : `
                                    <button class="btn btn-sm btn-secondary" style="width: 100%;" disabled>
                                        Waiting for Doctor to Finish
                                    </button>
                                `}
                            </div>
                        </div>
                    `;
                }).join("");
            }
        } catch (e) {
            console.error("Doctor rooms status error:", e);
        }
    },

    staffProcessToDoctor: async function (doctorId) {
        try {
            const res = await fetch("/api/staff/process-to-doctor", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    doctorId,
                    language: currentLanguage
                })
            });
            const data = await res.json();
            if (data.token) {
                this.toast(data.message, "success");
                VoiceAnnouncer.speak(data.announcementText, currentLanguage);
                this.loadDoctorRoomsStatus();
                this.fetchLiveQueues();
            } else {
                this.toast(data.error || "Could not process token", "error");
            }
        } catch (e) {
            this.toast("Dispatch error", "error");
        }
    },

    loadConsultedToday: async function () {
        try {
            const res = await fetch("/api/doctor/consulted-today");
            const consulted = await res.json();

            const staffTable = document.getElementById("staffConsultedTableBody");
            if (staffTable) {
                if (consulted.length === 0) {
                    staffTable.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">No patients consulted yet today.</td></tr>`;
                } else {
                    staffTable.innerHTML = consulted.map(c => `
                        <tr>
                            <td><span class="badge badge-success">${c.tokenNumber}</span></td>
                            <td>${c.patientName}</td>
                            <td>${c.doctorName}</td>
                            <td>${c.roomNumber}</td>
                            <td><small>${c.completedAt}</small></td>
                        </tr>
                    `).join("");
                }
            }

            const docTable = document.getElementById("doctorConsultedTableBody");
            if (docTable) {
                if (consulted.length === 0) {
                    docTable.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b;">No consultations completed yet today.</td></tr>`;
                } else {
                    docTable.innerHTML = consulted.map(c => `
                        <tr>
                            <td><span class="badge badge-success">${c.tokenNumber}</span></td>
                            <td>${c.patientName}</td>
                            <td>${c.roomNumber}</td>
                            <td><small>${c.completedAt}</small></td>
                        </tr>
                    `).join("");
                }
            }
        } catch (e) {
            console.error("Consulted history error:", e);
        }
    },

    staffCreateWalkin: async function () {
        const name = document.getElementById("walkinNameInput").value;
        const phone = document.getElementById("walkinPhoneInput").value;
        const priority = document.getElementById("walkinPrioritySelect").value;
        const reason = document.getElementById("walkinPriorityReasonInput").value;

        try {
            const res = await fetch("/api/staff/walkin-token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    name: name || "Walk-in Citizen",
                    phone: phone || "9825100999",
                    departmentId: "dept_gen_med",
                    priority,
                    priorityReason: reason
                })
            });
            const data = await res.json();
            if (data.token) {
                this.toast(`Generated Token: ${data.token.tokenNumber}`, "success");
                document.getElementById("walkinNameInput").value = "";
                document.getElementById("walkinPhoneInput").value = "";
                this.fetchLiveQueues();
            }
        } catch (e) {
            this.toast("Walk-in error", "error");
        }
    },

    staffCallToken: async function () {
        const tokenNum = document.getElementById("staffCallTokenInput").value;
        if (!tokenNum) {
            this.toast("Please enter a token number", "error");
            return;
        }

        try {
            const res = await fetch("/api/staff/call-token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    tokenNumber: tokenNum,
                    departmentId: "dept_gen_med",
                    language: currentLanguage
                })
            });
            const data = await res.json();
            if (data.announcementText) {
                VoiceAnnouncer.speak(data.announcementText, currentLanguage);
                this.toast(`Announcing Token ${tokenNum}`, "info");
                this.fetchLiveQueues();
            } else {
                this.toast(data.error || "Token not found", "error");
            }
        } catch (e) {
            this.toast("Staff announce error", "error");
        }
    },

    toggleQueuePause: async function (action) {
        const reason = prompt("Enter reason for queue pause/resume:", "Emergency case attending");
        if (reason === null) return;

        try {
            const res = await fetch("/api/staff/pause-queue", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    departmentId: "dept_gen_med",
                    action,
                    reason
                })
            });
            const data = await res.json();
            this.toast(data.message, "info");
            this.fetchLiveQueues();
        } catch (e) {
            this.toast("Pause error", "error");
        }
    },

    // ----------------- Laboratory Dashboard -----------------
    loadLabDashboard: async function () {
        if (!this.currentUser || this.currentUser.role !== "lab") {
            await this.quickLoginAs("lab");
        }
        try {
            const res = await fetch("/api/lab/orders", {
                headers: { "Authorization": `Bearer ${this.authToken}` }
            });
            const orders = await res.json();
            const table = document.getElementById("labOrdersTableBody");
            if (table) {
                table.innerHTML = orders.map(ord => `
                    <tr>
                        <td><strong>${ord.testName}</strong></td>
                        <td>${ord.patientName}</td>
                        <td><span class="badge ${ord.status === 'report_ready' ? 'badge-success' : 'badge-warning'}">${ord.status}</span></td>
                        <td>₹${ord.price || 100}</td>
                        <td>
                            ${ord.status === 'pending_collection' ? `
                                <button class="btn btn-sm btn-primary" onclick="App.updateLabStatus('${ord._id}', 'collected')">Mark Sample Collected</button>
                            ` : ord.status === 'collected' ? `
                                <button class="btn btn-sm btn-info" onclick="App.updateLabStatus('${ord._id}', 'report_ready')">Verify & Issue Report</button>
                            ` : `<span style="color: #16a34a; font-weight:bold;">Report Ready & Sent</span>`}
                        </td>
                    </tr>
                `).join("");
            }
        } catch (e) {
            console.error("Lab load error:", e);
        }
    },

    updateLabStatus: async function (orderId, status) {
        try {
            const res = await fetch("/api/lab/orders/update-status", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    orderId,
                    status,
                    reportText: "Automated Hematology Analyzer: Hemoglobin: 13.8 g/dL, WBC: 6,800/mcL, Platelets: 2.4 Lakh. Verified."
                })
            });
            const data = await res.json();
            this.toast(data.message, "success");
            this.loadLabDashboard();
        } catch (e) {
            this.toast("Lab update error", "error");
        }
    },

    // ----------------- Pharmacy Dashboard -----------------
    loadPharmacyDashboard: async function () {
        if (!this.currentUser || this.currentUser.role !== "pharmacy") {
            await this.quickLoginAs("pharmacy");
        }
        try {
            const [ordersRes, medsRes] = await Promise.all([
                fetch("/api/pharmacy/orders", { headers: { "Authorization": `Bearer ${this.authToken}` } }),
                fetch("/api/pharmacy/medicines")
            ]);
            const orders = await ordersRes.json();
            const medicines = await medsRes.json();

            const ordersTable = document.getElementById("pharmacyOrdersTableBody");
            if (ordersTable) {
                ordersTable.innerHTML = orders.map(ord => `
                    <tr>
                        <td><strong>${ord.prescriptionId || 'QS-RX-101'}</strong></td>
                        <td>${ord.patientName}</td>
                        <td>${ord.medicines.map(m => m.name).join(", ")}</td>
                        <td><span class="badge ${ord.status === 'dispensed' ? 'badge-success' : 'badge-warning'}">${ord.status}</span></td>
                        <td>
                            ${ord.status !== 'dispensed' ? `
                                <button class="btn btn-sm btn-success" onclick="App.dispenseMed('${ord._id}')">Dispense Medicines</button>
                            ` : `<span style="color:#16a34a;">Completed</span>`}
                        </td>
                    </tr>
                `).join("");
            }

            const medsTable = document.getElementById("pharmacyInventoryTableBody");
            if (medsTable) {
                medsTable.innerHTML = medicines.map(m => `
                    <tr>
                        <td><strong>${m.name}</strong></td>
                        <td>${m.generic}</td>
                        <td><span class="badge ${m.status === 'In Stock' ? 'badge-success' : 'badge-danger'}">${m.stock} ${m.unit}</span></td>
                        <td>₹${m.price}</td>
                    </tr>
                `).join("");
            }
        } catch (e) {
            console.error("Pharm load error:", e);
        }
    },

    dispenseMed: async function (orderId) {
        try {
            const res = await fetch("/api/pharmacy/dispense", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ orderId })
            });
            const data = await res.json();
            this.toast(data.message, "success");
            this.loadPharmacyDashboard();
        } catch (e) {
            this.toast("Dispense error", "error");
        }
    },

    // ----------------- Blood Bank Dashboard -----------------
    loadBloodBankDashboard: async function () {
        if (!this.currentUser || this.currentUser.role !== "bloodbank") {
            await this.quickLoginAs("bloodbank");
        }
        try {
            const [invRes, reqsRes] = await Promise.all([
                fetch("/api/bloodbank/inventory"),
                fetch("/api/bloodbank/requests", { headers: { "Authorization": `Bearer ${this.authToken}` } })
            ]);
            const inv = await invRes.json();
            const reqs = await reqsRes.json();

            const invGrid = document.getElementById("bloodInventoryGrid");
            if (invGrid) {
                invGrid.innerHTML = inv.map(b => `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center;">
                        <h2 style="color: #dc2626; font-size: 1.8rem; font-weight: 800;">${b.group}</h2>
                        <div style="font-size: 0.85rem; color: #64748b;">${b.component}</div>
                        <div style="font-size: 1.2rem; font-weight: bold; margin-top: 6px;">${b.unitsAvailable} Units</div>
                        <span class="badge ${b.status === 'Available' ? 'badge-success' : 'badge-danger'}" style="margin-top: 6px;">${b.status}</span>
                    </div>
                `).join("");
            }

            const reqTable = document.getElementById("bloodRequestsTableBody");
            if (reqTable) {
                reqTable.innerHTML = reqs.map(r => `
                    <tr>
                        <td><strong>${r.group}</strong></td>
                        <td>${r.units} Units</td>
                        <td>${r.patientName}</td>
                        <td><span class="badge ${r.urgency === 'Urgent' ? 'badge-danger' : 'badge-info'}">${r.urgency}</span></td>
                        <td><span class="badge ${r.status === 'fulfilled' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
                        <td>
                            ${r.status !== 'fulfilled' ? `
                                <button class="btn btn-sm btn-success" onclick="App.fulfillBloodRequest('${r._id}')">Fulfill</button>
                            ` : `<span style="color:#16a34a;">Fulfilled</span>`}
                        </td>
                    </tr>
                `).join("");
            }
        } catch (e) {
            console.error("Blood bank load error:", e);
        }
    },

    fulfillBloodRequest: async function (requestId) {
        try {
            const res = await fetch("/api/bloodbank/request/update", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ requestId, status: "fulfilled" })
            });
            const data = await res.json();
            this.toast(data.message, "success");
            this.loadBloodBankDashboard();
        } catch (e) {
            this.toast("Fulfill error", "error");
        }
    },

    // ----------------- Billing & Accounting -----------------
    loadPatientBills: async function () {
        try {
            const res = await fetch("/api/billing/bills", {
                headers: { "Authorization": `Bearer ${this.authToken}` }
            });
            const bills = await res.json();
            const listEl = document.getElementById("patientBillsList");
            if (listEl) {
                if (bills.length === 0) {
                    listEl.innerHTML = `<p style="color: #64748b; font-size: 0.9rem;">No bills currently pending.</p>`;
                } else {
                    listEl.innerHTML = bills.map(b => `
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong style="color: #0284c7;">${b.invoiceNumber}</strong>
                                    <div style="font-size: 0.85rem; color: #475569;">Items: ${b.items.map(i => `${i.name} (₹${i.total})`).join(", ")}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">₹${b.total}</div>
                                    <span class="badge ${b.status === 'paid' ? 'badge-success' : 'badge-warning'}">${b.status.toUpperCase()}</span>
                                </div>
                            </div>
                            ${b.status !== 'paid' ? `
                                <div style="margin-top: 10px; display: flex; gap: 8px;">
                                    <button class="btn btn-sm btn-primary" onclick="App.payBill('${b._id}', 'Online Simulator')">Pay Online (UPI / Card)</button>
                                    <button class="btn btn-sm btn-secondary" onclick="App.payBill('${b._id}', 'Cash at Counter')">Record Cash Receipt</button>
                                </div>
                            ` : `<div style="font-size: 0.8rem; color: #16a34a; margin-top: 6px;">Receipt: ${b.receiptNo} (${b.paymentMode})</div>`}
                        </div>
                    `).join("");
                }
            }
        } catch (e) {
            console.error("Bills error:", e);
        }
    },

    payBill: async function (billId, mode) {
        try {
            const res = await fetch("/api/billing/pay", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ billId, mode })
            });
            const data = await res.json();
            this.toast(`Payment Confirmed! Receipt: ${data.receiptNo}`, "success");
            this.loadPatientBills();
        } catch (e) {
            this.toast("Pay error", "error");
        }
    },

    loadPatientLabOrders: async function () {
        try {
            const res = await fetch("/api/lab/orders", {
                headers: { "Authorization": `Bearer ${this.authToken}` }
            });
            const orders = await res.json();
            const container = document.getElementById("patientLabReportsList");
            if (container) {
                if (orders.length === 0) {
                    container.innerHTML = `<p style="color: #64748b; font-size: 0.9rem;">No diagnostic orders recorded.</p>`;
                } else {
                    container.innerHTML = orders.map(ord => `
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong>🔬 ${ord.testName}</strong>
                                <span class="badge ${ord.status === 'report_ready' ? 'badge-success' : 'badge-warning'}">${ord.status}</span>
                            </div>
                            ${ord.report ? `
                                <div style="margin-top: 8px; background: #f0fdf4; border-left: 3px solid #16a34a; padding: 8px; font-size: 0.85rem;">
                                    <strong>Result:</strong> ${ord.report.result}
                                    <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">Verified by: ${ord.report.verifiedBy}</div>
                                </div>
                            ` : `<div style="font-size: 0.82rem; color: #64748b; margin-top: 4px;">Sample awaiting collection at Central Lab Counter 3.</div>`}
                        </div>
                    `).join("");
                }
            }
        } catch (e) {
            console.error("Lab patient reports error:", e);
        }
    },

    // ----------------- Emergency Assistance -----------------
    triggerEmergency: async function () {
        try {
            const res = await fetch("/api/emergency/assist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: this.currentUser ? this.currentUser.phone : "Walk-in" })
            });
            const data = await res.json();
            const modal = document.getElementById("emergencyModal");
            const info = document.getElementById("emergencyModalInfo");
            if (modal && info) {
                info.innerHTML = `
                    <div style="color: #991b1b; font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">
                        🚨 ${data.status}
                    </div>
                    <p style="font-size: 0.95rem; margin-bottom: 12px;">${data.instructions}</p>
                    <div style="background: #fee2e2; padding: 12px; border-radius: 8px; font-size: 0.9rem;">
                        <div><strong>24/7 Hotline:</strong> <a href="tel:108" style="color: #dc2626; font-weight: bold;">${data.hospitalEmergencyHotline}</a></div>
                        <div><strong>Triage Officer:</strong> ${data.traumaDutyOfficer}</div>
                        <div><strong>Route:</strong> ${data.redZoneLocation}</div>
                    </div>
                    <div style="margin-top: 16px; text-align: center;">
                        <button class="btn btn-danger" onclick="HospitalNavigator.selectLocation('loc_emergency'); document.getElementById('emergencyModal').classList.remove('active');">Highlight Route on Indoor Map</button>
                    </div>
                `;
                modal.classList.add("active");
            }
        } catch (e) {
            this.toast("Emergency trigger error", "error");
        }
    },

    // ----------------- Admin Dashboard -----------------
    loadAdminDashboard: async function () {
        if (!this.currentUser || this.currentUser.role !== "admin") {
            await this.quickLoginAs("admin");
        }
        try {
            const [metRes, auditRes, secRes] = await Promise.all([
                fetch("/api/admin/metrics", { headers: { "Authorization": `Bearer ${this.authToken}` } }),
                fetch("/api/admin/audit-logs", { headers: { "Authorization": `Bearer ${this.authToken}` } }),
                fetch("/api/admin/security-events", { headers: { "Authorization": `Bearer ${this.authToken}` } })
            ]);
            const metrics = await metRes.json();
            const auditLogs = await auditRes.json();
            const secEvents = await secRes.json();

            // Render Metrics
            const metBox = document.getElementById("adminMetricsGrid");
            if (metBox) {
                metBox.innerHTML = `
                    <div class="card"><div class="card-title">Registered Patients</div><h2 style="color:#0284c7;">${metrics.totalPatients}</h2></div>
                    <div class="card"><div class="card-title">Active Doctors</div><h2 style="color:#0f766e;">${metrics.activeDoctors}</h2></div>
                    <div class="card"><div class="card-title">Tokens In Queue</div><h2 style="color:#f59e0b;">${metrics.tokensWaiting}</h2></div>
                    <div class="card"><div class="card-title">Tokens Served</div><h2 style="color:#16a34a;">${metrics.tokensServed}</h2></div>
                    <div class="card"><div class="card-title">Pending Lab Tests</div><h2 style="color:#9333ea;">${metrics.pendingLabTests}</h2></div>
                    <div class="card"><div class="card-title">Cybersecurity Events</div><h2 style="color:#dc2626;">${metrics.securityAlertsCount}</h2></div>
                `;
            }

            // Render Audit Logs
            const auditBody = document.getElementById("adminAuditTableBody");
            if (auditBody) {
                auditBody.innerHTML = auditLogs.map(l => `
                    <tr>
                        <td><small>${l.timestamp.substring(11, 19)}</small></td>
                        <td><span class="badge badge-info">${l.role}</span></td>
                        <td><strong>${l.action}</strong></td>
                        <td>${l.username}</td>
                        <td><small>${JSON.stringify(l.details || {})}</small></td>
                    </tr>
                `).join("");
            }

            // Render Security Events
            const secBody = document.getElementById("adminSecurityTableBody");
            if (secBody) {
                secBody.innerHTML = secEvents.map(s => `
                    <tr>
                        <td><small>${s.timestamp.substring(11, 19)}</small></td>
                        <td><span class="badge ${s.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}">${s.severity}</span></td>
                        <td><strong>${s.eventType}</strong></td>
                        <td><small>${JSON.stringify(s.details || {})}</small></td>
                    </tr>
                `).join("");
            }
        } catch (e) {
            console.error("Admin dash load error:", e);
        }
    }
};

window.addEventListener("DOMContentLoaded", () => {
    App.init();
});
