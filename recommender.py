"""
Smart Appointment Recommendation Engine for QueueSeva
Analyzes doctor schedules, live queue loads, consultation duration,
and user preferences to recommend optimal arrival windows and alternative slots.
"""

from datetime import datetime, time, timedelta
from db import get_collection

TIME_SLOT_RANGES = {
    "morning_early": {"start": "08:00", "end": "09:00", "label": "8:00 AM – 9:00 AM"},
    "morning_mid": {"start": "09:00", "end": "10:00", "label": "9:00 AM – 10:00 AM"},
    "morning_late": {"start": "10:00", "end": "11:00", "label": "10:00 AM – 11:00 AM"},
    "noon_early": {"start": "11:00", "end": "12:00", "label": "11:00 AM – 12:00 PM"},
    "noon_mid": {"start": "12:00", "end": "13:00", "label": "12:00 PM – 1:00 PM"},
    "afternoon_early": {"start": "13:00", "end": "14:00", "label": "1:00 PM – 2:00 PM"},
    "afternoon_mid": {"start": "14:00", "end": "15:00", "label": "2:00 PM – 3:00 PM"},
    "afternoon_late": {"start": "15:00", "end": "16:00", "label": "3:00 PM – 4:00 PM"},
    "evening": {"start": "16:00", "end": "17:00", "label": "4:00 PM – 5:00 PM"}
}

def parse_time_str(t_str):
    parts = t_str.split(":")
    return time(int(parts[0]), int(parts[1]))

def recommend_appointment(date_str: str, time_range_key: str, department_id: str, doctor_id: str = None, has_accessibility_need: bool = False):
    """
    Evaluates availability for preferred time range and generates
    smart arrival window + appointment slot or nearest alternatives.
    """
    doctors_col = get_collection("doctors")
    appointments_col = get_collection("appointments")
    queues_col = get_collection("queues")

    # Find doctor
    doctor_query = {"departmentId": department_id, "status": "active"}
    if doctor_id and doctor_id != "any":
        doctor_query["_id"] = doctor_id
    doctor = doctors_col.find_one(doctor_query)

    if not doctor:
        # Fallback to any active doctor in department
        doctor = doctors_col.find_one({"departmentId": department_id})
        if not doctor:
            doctor = {
                "_id": "doc_default",
                "name": "General Duty Medical Officer",
                "departmentId": department_id,
                "roomNumber": "OPD Room 1",
                "avgConsultationMins": 10
            }

    avg_duration = doctor.get("avgConsultationMins", 10)
    pref_range = TIME_SLOT_RANGES.get(time_range_key, TIME_SLOT_RANGES["morning_mid"])

    # Count existing bookings in this range on that date
    existing_bookings = appointments_col.find({
        "doctorId": str(doctor.get("_id")),
        "date": date_str,
        "status": {"$in": ["confirmed", "checked_in", "in_consultation"]}
    })
    
    existing_count = len(existing_bookings)
    max_capacity_per_hour = 60 // avg_duration  # e.g., 6 slots per hour
    
    # Check if preferred range is congested
    range_bookings = [b for b in existing_bookings if b.get("timeRangeKey") == time_range_key]
    is_congested = len(range_bookings) >= max_capacity_per_hour

    # Calculate recommended arrival window and slot
    start_h, start_m = map(int, pref_range["start"].split(":"))
    pref_start_dt = datetime.strptime(f"{date_str} {pref_range['start']}", "%Y-%m-%d %H:%M")
    
    # Determine slot minute offset based on queue in that hour
    offset_mins = min(len(range_bookings) * avg_duration, 45)
    slot_dt = pref_start_dt + timedelta(minutes=offset_mins)
    # Arrival window recommended 15 mins before expected doctor consultation
    arrival_window_start = slot_dt - timedelta(minutes=15)
    arrival_window_end = slot_dt - timedelta(minutes=5)

    expected_wait_mins = max(10, len(range_bookings) * avg_duration + (5 if has_accessibility_need else 0))

    if not is_congested:
        return {
            "status": "available",
            "message": f"Optimal slot identified during your preferred window ({pref_range['label']}).",
            "recommendedSlot": slot_dt.strftime("%I:%M %p"),
            "recommendedArrivalWindow": f"{arrival_window_start.strftime('%I:%M %p')} – {arrival_window_end.strftime('%I:%M %p')}",
            "expectedWaitMins": expected_wait_mins,
            "doctorId": str(doctor.get("_id")),
            "doctorName": doctor.get("name"),
            "departmentId": department_id,
            "roomNumber": doctor.get("roomNumber", "Room 3"),
            "alternatives": []
        }
    else:
        # Generate closest alternative time ranges
        keys = list(TIME_SLOT_RANGES.keys())
        current_idx = keys.index(time_range_key) if time_range_key in keys else 0
        alternatives = []
        
        # Check next slots
        for next_idx in [current_idx + 1, current_idx + 2, current_idx - 1]:
            if 0 <= next_idx < len(keys):
                alt_key = keys[next_idx]
                alt_range = TIME_SLOT_RANGES[alt_key]
                alt_start_dt = datetime.strptime(f"{date_str} {alt_range['start']}", "%Y-%m-%d %H:%M")
                alternatives.append({
                    "timeRangeKey": alt_key,
                    "label": alt_range["label"],
                    "recommendedSlot": alt_start_dt.strftime("%I:%M %p"),
                    "arrivalWindow": f"{(alt_start_dt - timedelta(minutes=15)).strftime('%I:%M %p')} – {(alt_start_dt - timedelta(minutes=5)).strftime('%I:%M %p')}"
                })

        return {
            "status": "alternative_suggested",
            "message": f"Your preferred time window ({pref_range['label']}) has reached maximum safe capacity. We recommend the following nearest alternative arrival windows to prevent long waiting times:",
            "recommendedSlot": slot_dt.strftime("%I:%M %p"),
            "recommendedArrivalWindow": f"{arrival_window_start.strftime('%I:%M %p')} – {arrival_window_end.strftime('%I:%M %p')}",
            "expectedWaitMins": expected_wait_mins + 20,
            "doctorId": str(doctor.get("_id")),
            "doctorName": doctor.get("name"),
            "departmentId": department_id,
            "roomNumber": doctor.get("roomNumber", "Room 3"),
            "alternatives": alternatives
        }
