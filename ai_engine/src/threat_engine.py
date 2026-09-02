from datetime import datetime


# ============================================================
# RISK WEIGHT CONFIGURATION
# ============================================================

BORDER_INTRUSION_RISK = 30
CARRIED_OBJECT_RISK = 25
NIGHT_TIME_RISK = 15
LONG_DWELL_RISK = 15
GROUP_ENTRY_RISK = 15

# Vehicle & License Plate Country Risk Weights
VEHICLE_PRESENT_RISK = 10
NON_INDIA_PLATE_RISK = 25
UNKNOWN_PLATE_RISK = 25

# Night time hours (18:00 through 05:59)
NIGHT_START = 18
NIGHT_END = 6


def is_night_time(hour: int = None) -> bool:
    """
    Returns True if current system time (or provided hour) falls in night hours (18:00 - 05:59).
    """
    if hour is None:
        hour = datetime.now().hour
    return hour >= NIGHT_START or hour < NIGHT_END


def calculate_threat_score(
    intrusion: bool = False,
    carried_object: bool = False,
    night_time: bool = False,
    long_dwell: bool = False,
    group_entry: bool = False,
    person_id: int = None,
    vehicle_present: bool = False,
    plate_country: str = None
) -> dict:
    """
    Calculates threat score, level (LOW, MEDIUM, HIGH), and active risk factors.

    Risk Weights:
      - Border intrusion : +30
      - Carried object    : +25
      - Night time        : +15
      - Long dwell        : +15
      - Group entry       : +15
      - Vehicle present   : +10
      - Non-Indian vehicle: +25 (+35 total)
      - Unknown vehicle   : +25 (+35 total)
      - Indian vehicle    : +0  (+10 total)
    """
    score = 0
    factors = []

    if intrusion:
        score += BORDER_INTRUSION_RISK
        factors.append("Border intrusion")

    if carried_object:
        score += CARRIED_OBJECT_RISK
        factors.append("Carried object")

    if night_time:
        score += NIGHT_TIME_RISK
        factors.append("Night time")

    if long_dwell:
        score += LONG_DWELL_RISK
        factors.append("Long dwell")

    if group_entry:
        score += GROUP_ENTRY_RISK
        factors.append("Group entry")

    if vehicle_present:
        score += VEHICLE_PRESENT_RISK
        factors.append("Vehicle present")

        country = (plate_country or "UNKNOWN").upper()
        if country == "NON_INDIA":
            score += NON_INDIA_PLATE_RISK
            factors.append("Non-Indian vehicle")
        elif country == "UNKNOWN":
            score += UNKNOWN_PLATE_RISK
            factors.append("Unknown vehicle")
        elif country == "INDIA":
            pass

    # Clamp maximum theoretical score to 100
    score = min(score, 100)

    # Determine Threat Level
    if score < 30:
        level = "LOW"
    elif score < 60:
        level = "MEDIUM"
    else:
        level = "HIGH"

    result = {
        "score": score,
        "level": level,
        "risk_factors": factors,
        "factors": factors
    }

    if person_id is not None:
        result["person_id"] = person_id
        result["threat_score"] = score
        result["threat_level"] = level

    return result
