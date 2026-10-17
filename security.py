"""
Cybersecurity and RBAC Module for QueueSeva
Handles password hashing, token validation, role-based authorization,
audit logging, and security event monitoring.
"""

import bcrypt
import secrets
import logging
from datetime import datetime
from functools import wraps
from flask import request, jsonify, g
from db import get_collection

logger = logging.getLogger("QueueSeva.Security")

VALID_ROLES = ["patient", "doctor", "staff", "lab", "pharmacy", "bloodbank", "admin"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def generate_session_token() -> str:
    return secrets.token_hex(24)

def log_audit(user_id: str, username: str, role: str, action: str, details: dict, ip_address: str = None):
    audit_col = get_collection("auditLogs")
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "userId": user_id,
        "username": username,
        "role": role,
        "action": action,
        "details": details,
        "ipAddress": ip_address or request.remote_addr if request else "system"
    }
    audit_col.insert_one(entry)
    logger.info(f"[AUDIT] {role.upper()} {username}: {action}")

def log_security_event(event_type: str, severity: str, details: dict, ip_address: str = None):
    sec_col = get_collection("securityEvents")
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "eventType": event_type,
        "severity": severity,  # LOW, MEDIUM, HIGH, CRITICAL
        "details": details,
        "ipAddress": ip_address or request.remote_addr if request else "system"
    }
    sec_col.insert_one(entry)
    logger.warning(f"[SECURITY ALERT] {severity} - {event_type} - {details}")

def get_current_user():
    token = request.headers.get("Authorization")
    if not token and "token" in request.cookies:
        token = request.cookies.get("token")
    if token and token.startswith("Bearer "):
        token = token.split(" ", 1)[1]

    if not token:
        return None

    users_col = get_collection("users")
    user = users_col.find_one({"sessionToken": token})
    return user

def require_auth(roles=None):
    """
    Decorator for RBAC. If roles is provided (string or list),
    checks that the authenticated user possesses an allowed role.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                log_security_event(
                    "UNAUTHORIZED_ACCESS_ATTEMPT",
                    "MEDIUM",
                    {"endpoint": request.path, "ip": request.remote_addr}
                )
                return jsonify({"error": "Authentication required. Please log in."}), 401

            if roles:
                allowed = [roles] if isinstance(roles, str) else roles
                if user.get("role") not in allowed and user.get("role") != "admin":
                    log_security_event(
                        "ROLE_VIOLATION_ATTEMPT",
                        "HIGH",
                        {
                            "endpoint": request.path,
                            "userId": str(user.get("_id")),
                            "userRole": user.get("role"),
                            "requiredRoles": allowed
                        }
                    )
                    return jsonify({"error": f"Access denied. Requires role: {', '.join(allowed)}"}), 403

            g.user = user
            return f(*args, **kwargs)
        return wrapper
    return decorator

def sanitize_input(text: str) -> str:
    """Basic XSS prevention escaping"""
    if not isinstance(text, str):
        return text
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#x27;")
    )
