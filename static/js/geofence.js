/**
 * QueueSeva GPS Geofence & Arrival Detection Module
 * Checks distance to hospital geofence (200m) with simulator for hackathon tests
 */

const GeofenceDetector = {
    hospitalCoords: { lat: 23.0525, lng: 72.5855 }, // Ahmedabad Civil Hospital
    geofenceRadiusMeters: 200,
    hasArrived: false,

    init: function () {
        // Automatically check location if user permits
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => this.processCoords(pos.coords.latitude, pos.coords.longitude),
                (err) => console.log("GPS prompt skipped or denied; simulator available.")
            );
        }
    },

    processCoords: async function (lat, lng, forcedDistance = null) {
        let distanceMeters = forcedDistance;
        if (distanceMeters === null) {
            distanceMeters = this.calculateDistance(lat, lng, this.hospitalCoords.lat, this.hospitalCoords.lng);
        }

        try {
            const res = await fetch("/api/geofence/arrival", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lng, distanceMeters })
            });
            const data = await res.json();

            const geofenceBox = document.getElementById("geofenceStatusBox");
            if (geofenceBox) {
                if (data.insideGeofence) {
                    this.hasArrived = true;
                    geofenceBox.style.display = "block";
                    geofenceBox.innerHTML = `
                        <div class="geofence-alert">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <div>
                                    <strong style="color: #065f46; font-size: 1.05rem;">📍 Hospital Arrival Detected (${Math.round(distanceMeters)}m)!</strong>
                                    <p style="margin-top: 4px; color: #047857; font-size: 0.9rem;">${data.message}</p>
                                </div>
                                <button class="btn btn-success" onclick="App.confirmArrivalCheckin()">Confirm Hospital Check-In</button>
                            </div>
                        </div>
                    `;
                } else {
                    geofenceBox.style.display = "block";
                    geofenceBox.innerHTML = `
                        <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 6px; font-size: 0.85rem; color: #64748b;">
                            📡 GPS Status: Distance to Hospital: <strong>${Math.round(distanceMeters)} meters</strong>. (Geofence threshold: 200m).
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.error("Geofence check error:", e);
        }
    },

    // Haversine formula to calculate meters
    calculateDistance: function (lat1, lon1, lat2, lon2) {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    simulateArrival: function () {
        // Trigger simulated proximity of 110m (inside geofence)
        this.processCoords(23.0530, 72.5860, 110);
    }
};
