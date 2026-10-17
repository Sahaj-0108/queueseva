/**
 * QueueSeva Indoor Hospital Navigation & Transit Guide
 * Interactive SVG floor map with route drawing and nearby transit stops
 */

const HospitalNavigator = {
    locations: [],
    transportNodes: [],
    currentDestination: null,

    init: async function () {
        try {
            const locRes = await fetch("/api/navigation/locations");
            this.locations = await locRes.json();

            const trRes = await fetch("/api/navigation/transport");
            this.transportNodes = await trRes.json();

            this.renderMap();
            this.renderTransitGuide();
        } catch (e) {
            console.error("Navigation load error:", e);
        }
    },

    renderMap: function () {
        const container = document.getElementById("hospitalMapContainer");
        if (!container) return;

        // Render SVG layout
        container.innerHTML = `
            <div class="map-canvas-container">
                <svg class="map-svg" viewBox="0 0 650 480" xmlns="http://www.w3.org/2000/svg">
                    <!-- Hospital Building Boundary -->
                    <rect x="20" y="20" width="610" height="440" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4" />
                    
                    <!-- Corridor / Hallways -->
                    <path d="M 60 380 L 590 380 M 220 380 L 220 120 M 360 380 L 360 120 M 60 160 L 590 160" 
                          stroke="#e2e8f0" stroke-width="28" stroke-linecap="round" fill="none" />
                    
                    <!-- Main Entrance & Reception -->
                    <rect id="zone_entrance" class="map-zone" x="60" y="390" width="130" height="55" rx="6" 
                          fill="#38bdf8" stroke="#0284c7" stroke-width="2" onclick="HospitalNavigator.selectLocation('loc_entrance')" />
                    <text x="125" y="422" fill="#0369a1" font-size="11" font-weight="bold" text-anchor="middle">Main Entrance</text>

                    <!-- Registration Desk -->
                    <rect id="zone_reg" class="map-zone" x="210" y="350" width="120" height="50" rx="6" 
                          fill="#bae6fd" stroke="#0284c7" stroke-width="2" onclick="HospitalNavigator.selectLocation('loc_reg')" />
                    <text x="270" y="380" fill="#075985" font-size="11" font-weight="bold" text-anchor="middle">Registration / Token</text>

                    <!-- OPD Room 3 (Dr. Aarav) -->
                    <rect id="zone_opd_med" class="map-zone" x="330" y="250" width="110" height="60" rx="6" 
                          fill="#bbf7d0" stroke="#16a34a" stroke-width="2" onclick="HospitalNavigator.selectLocation('loc_opd_med')" />
                    <text x="385" y="280" fill="#166534" font-size="11" font-weight="bold" text-anchor="middle">OPD Room 3</text>
                    <text x="385" y="295" fill="#166534" font-size="9" text-anchor="middle">Gen. Medicine</text>

                    <!-- OPD Room 8 (Ortho) -->
                    <rect id="zone_opd_ortho" class="map-zone" x="460" y="250" width="110" height="60" rx="6" 
                          fill="#bbf7d0" stroke="#16a34a" stroke-width="2" onclick="HospitalNavigator.selectLocation('loc_opd_ortho')" />
                    <text x="515" y="280" fill="#166534" font-size="11" font-weight="bold" text-anchor="middle">OPD Room 8</text>
                    <text x="515" y="295" fill="#166534" font-size="9" text-anchor="middle">Orthopedics</text>

                    <!-- Central Lab -->
                    <rect id="zone_lab" class="map-zone" x="330" y="70" width="120" height="65" rx="6" 
                          fill="#fef08a" stroke="#ca8a04" stroke-width="2" onclick="HospitalNavigator.selectLocation('loc_lab')" />
                    <text x="390" y="100" fill="#854d0e" font-size="11" font-weight="bold" text-anchor="middle">Pathology Lab</text>
                    <text x="390" y="115" fill="#854d0e" font-size="9" text-anchor="middle">Sample Collection</text>

                    <!-- Jan Aushadhi Pharmacy -->
                    <rect id="zone_pharmacy" class="map-zone" x="180" y="170" width="120" height="60" rx="6" 
                          fill="#fed7aa" stroke="#ea580c" stroke-width="2" onclick="HospitalNavigator.selectLocation('loc_pharmacy')" />
                    <text x="240" y="200" fill="#9a3412" font-size="11" font-weight="bold" text-anchor="middle">Pharmacy</text>
                    <text x="240" y="215" fill="#9a3412" font-size="9" text-anchor="middle">Jan Aushadhi</text>

                    <!-- Blood Bank -->
                    <rect id="zone_bloodbank" class="map-zone" x="470" y="70" width="120" height="65" rx="6" 
                          fill="#fecdd3" stroke="#e11d48" stroke-width="2" onclick="HospitalNavigator.selectLocation('loc_bloodbank')" />
                    <text x="530" y="100" fill="#9f1239" font-size="11" font-weight="bold" text-anchor="middle">Blood Bank</text>
                    <text x="530" y="115" fill="#9f1239" font-size="9" text-anchor="middle">Transfusion Unit</text>

                    <!-- Billing Counter -->
                    <rect id="zone_billing" class="map-zone" x="180" y="260" width="120" height="50" rx="6" 
                          fill="#e9d5ff" stroke="#9333ea" stroke-width="2" onclick="HospitalNavigator.selectLocation('loc_billing')" />
                    <text x="240" y="290" fill="#6b21a8" font-size="11" font-weight="bold" text-anchor="middle">Central Billing</text>

                    <!-- Emergency Red Zone -->
                    <rect id="zone_emergency" class="map-zone" x="50" y="80" width="100" height="120" rx="6" 
                          fill="#fca5a5" stroke="#dc2626" stroke-width="3" onclick="HospitalNavigator.selectLocation('loc_emergency')" />
                    <text x="100" y="135" fill="#991b1b" font-size="11" font-weight="bold" text-anchor="middle">EMERGENCY</text>
                    <text x="100" y="150" fill="#991b1b" font-size="9" font-weight="bold" text-anchor="middle">Red Zone Bay</text>

                    <!-- Lifts & Ramp -->
                    <circle id="zone_lift" class="map-zone" cx="300" cy="220" r="22" 
                            fill="#cbd5e1" stroke="#475569" stroke-width="2" onclick="HospitalNavigator.selectLocation('loc_lift')" />
                    <text x="300" y="224" fill="#1e293b" font-size="9" font-weight="bold" text-anchor="middle">Lifts / Ramp</text>

                    <!-- Dynamic Navigation Route Path -->
                    <path id="navRoutePath" d="" stroke="#0284c7" stroke-width="5" stroke-dasharray="8,6" fill="none" opacity="0.85" />
                    <!-- Animated Walker Pin -->
                    <circle id="navWalkerPin" cx="-50" cy="-50" r="7" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
                </svg>
            </div>
            
            <div id="mapDestinationInfo" style="margin-top: 12px; padding: 12px; background: #e0f2fe; border-radius: 8px; display: none;">
                <strong id="navDestTitle">Destination</strong>: <span id="navDestDesc"></span>
            </div>

            <div class="map-legend">
                <div class="legend-item"><div class="legend-color" style="background:#38bdf8;"></div> Entrance</div>
                <div class="legend-item"><div class="legend-color" style="background:#bbf7d0;"></div> OPD Rooms</div>
                <div class="legend-item"><div class="legend-color" style="background:#fef08a;"></div> Lab</div>
                <div class="legend-item"><div class="legend-color" style="background:#fed7aa;"></div> Pharmacy</div>
                <div class="legend-item"><div class="legend-color" style="background:#fecdd3;"></div> Blood Bank</div>
                <div class="legend-item"><div class="legend-color" style="background:#fca5a5;"></div> Emergency</div>
                <div class="legend-item"><div class="legend-color" style="background:#cbd5e1;"></div> Lifts/Ramp</div>
            </div>
        `;
    },

    selectLocation: function (locId) {
        const loc = this.locations.find(l => l.id === locId);
        if (!loc) return;

        this.currentDestination = loc;
        const infoBox = document.getElementById("mapDestinationInfo");
        const titleEl = document.getElementById("navDestTitle");
        const descEl = document.getElementById("navDestDesc");
        if (infoBox && titleEl && descEl) {
            infoBox.style.display = "block";
            titleEl.innerText = loc.name;
            descEl.innerText = `${loc.floor} • ${loc.desc}`;
        }

        // Draw walking path from entrance (x: 125, y: 415) to target (loc.x, loc.y)
        const pathEl = document.getElementById("navRoutePath");
        const pinEl = document.getElementById("navWalkerPin");
        if (pathEl && pinEl) {
            const startX = 125, startY = 415;
            const midY = 380;
            const targetX = loc.x || 300;
            const targetY = loc.y || 200;
            
            // Create orthogonal path along corridor
            const dStr = `M ${startX} ${startY} L ${startX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
            pathEl.setAttribute("d", dStr);

            // Place pin at target
            pinEl.setAttribute("cx", targetX);
            pinEl.setAttribute("cy", targetY);
        }
    },

    renderTransitGuide: function () {
        const container = document.getElementById("transitGuideContainer");
        if (!container) return;

        let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">`;
        this.transportNodes.forEach(tr => {
            html += `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${tr.type === 'Metro' ? '🚇' : tr.type === 'Bus' ? '🚌' : '🚖'} ${tr.name}</strong>
                    </div>
                    <div style="font-size: 0.85rem; color: #0284c7; font-weight: 600; margin-top: 4px;">📍 ${tr.distance}</div>
                    <div style="font-size: 0.82rem; color: #64748b; margin-top: 2px;">${tr.routes}</div>
                    <div style="font-size: 0.78rem; color: #16a34a; font-weight: bold; margin-top: 4px;">🕒 ${tr.freq}</div>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
    }
};
