import cv2
import time
from datetime import datetime
from ultralytics import YOLO


# ==========================================
# CONFIGURATION
# ==========================================

MODEL_PATH = "yolo11n.pt"

# Restricted zone
ZONE_X1 = 150
ZONE_Y1 = 100
ZONE_X2 = 550
ZONE_Y2 = 450

CONFIDENCE_THRESHOLD = 0.60

# Person must remain inside this long
# to be considered a long dwell
DWELL_THRESHOLD = 30

# People entering within this time
# are considered a group entry
GROUP_ENTRY_WINDOW = 5


# ==========================================
# LOAD MODEL
# ==========================================

model = YOLO(MODEL_PATH)


# ==========================================
# CAMERA
# ==========================================

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise RuntimeError("Could not open camera")


# ==========================================
# STATE
# ==========================================

# People who have already triggered
# a basic breach event
breached_ids = set()

# Track when each person entered the zone
dwell_start_times = {}

# Prevent repeated dwell alerts
dwell_alerted_ids = set()

# Previous frame's people inside zone
previous_inside_ids = set()

# Entry time for each person
entry_times = {}

# Last group that triggered an alert
last_group_alert_ids = set()


# ==========================================
# MAIN LOOP
# ==========================================

while True:

    ret, frame = cap.read()

    if not ret:
        print("Could not read frame")
        break


    # ======================================
    # DRAW RESTRICTED ZONE
    # ======================================

    cv2.rectangle(
        frame,
        (ZONE_X1, ZONE_Y1),
        (ZONE_X2, ZONE_Y2),
        (255, 255, 0),
        2
    )

    cv2.putText(
        frame,
        "RESTRICTED ZONE",
        (ZONE_X1, ZONE_Y1 - 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 0),
        2
    )


    # ======================================
    # YOLO + BYTE TRACK
    # ======================================

    results = model.track(
        frame,
        persist=True,
        tracker="bytetrack.yaml",
        classes=[0],
        conf=CONFIDENCE_THRESHOLD,
        iou=0.50,
        verbose=False
    )


    person_count = 0
    current_breaches = 0

    current_inside_ids = set()


    # ======================================
    # PROCESS DETECTIONS
    # ======================================

    for result in results:

        for box in result.boxes:

            if box.id is None:
                continue

            confidence = float(box.conf[0])

            track_id = int(box.id[0])

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )

            person_count += 1


            # ==================================
            # PERSON CENTER
            # ==================================

            center_x = int((x1 + x2) / 2)
            center_y = int((y1 + y2) / 2)


            # ==================================
            # CHECK RESTRICTED ZONE
            # ==================================

            inside_zone = (
                ZONE_X1 <= center_x <= ZONE_X2
                and
                ZONE_Y1 <= center_y <= ZONE_Y2
            )


            # ==================================
            # PERSON INSIDE ZONE
            # ==================================

            if inside_zone:

                current_breaches += 1

                current_inside_ids.add(track_id)


                # ==================================
                # FIRST ENTRY
                # ==================================

                if track_id not in previous_inside_ids:

                    now = time.time()

                    entry_times[track_id] = now

                    dwell_start_times[track_id] = now


                    # Basic breach event
                    if track_id not in breached_ids:

                        breached_ids.add(track_id)

                        timestamp = datetime.now().strftime(
                            "%Y-%m-%d %H:%M:%S"
                        )

                        print()
                        print("=" * 55)
                        print("🚨 BORDER INTRUSION DETECTED")
                        print(f"Track ID      : {track_id}")
                        print(f"Confidence    : {confidence:.2f}")
                        print(f"Time          : {timestamp}")
                        print("Event         : Restricted Zone Breach")
                        print("=" * 55)
                        print()


            # ==================================
            # DWELL TIME
            # ==================================

            if inside_zone:

                if track_id in dwell_start_times:

                    dwell_time = (
                        time.time()
                        - dwell_start_times[track_id]
                    )

                    # Display dwell time
                    cv2.putText(
                        frame,
                        f"DWELL: {dwell_time:.1f}s",
                        (x1, y2 + 25),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (0, 0, 255),
                        2
                    )


                    # Long dwell detected
                    if (
                        dwell_time >= DWELL_THRESHOLD
                        and
                        track_id not in dwell_alerted_ids
                    ):

                        dwell_alerted_ids.add(track_id)

                        timestamp = datetime.now().strftime(
                            "%Y-%m-%d %H:%M:%S"
                        )

                        print()
                        print("=" * 55)
                        print("⚠️ LONG DWELL DETECTED")
                        print(f"Track ID      : {track_id}")
                        print(f"Dwell Time    : {dwell_time:.1f} seconds")
                        print(f"Time          : {timestamp}")
                        print("Event         : Extended Presence")
                        print("=" * 55)
                        print()


            # ==================================
            # DRAW PERSON
            # ==================================

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 0, 255),
                2
            )


            # ==================================
            # CENTER POINT
            # ==================================

            cv2.circle(
                frame,
                (center_x, center_y),
                5,
                (0, 0, 255),
                -1
            )


            # ==================================
            # PERSON LABEL
            # ==================================

            label = (
                f"PERSON #{track_id} "
                f"| {confidence:.2f}"
            )

            cv2.putText(
                frame,
                label,
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.60,
                (0, 0, 255),
                2
            )


    # ==========================================
    # GROUP ENTRY DETECTION
    # ==========================================

    current_time = time.time()


    # Remove old entries
    expired_ids = []

    for track_id, entry_time in entry_times.items():

        if current_time - entry_time > GROUP_ENTRY_WINDOW:

            expired_ids.append(track_id)


    for track_id in expired_ids:

        del entry_times[track_id]


    # Check for multiple recent entries
    recent_entry_ids = set(entry_times.keys())


    if len(recent_entry_ids) >= 2:

        if recent_entry_ids != last_group_alert_ids:

            last_group_alert_ids = recent_entry_ids.copy()

            timestamp = datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            )

            print()
            print("=" * 55)
            print("🚨 GROUP ENTRY DETECTED")
            print(
                f"People Entered : "
                f"{len(recent_entry_ids)}"
            )
            print(
                f"Track IDs      : "
                f"{sorted(recent_entry_ids)}"
            )
            print(f"Time           : {timestamp}")
            print("Event          : Multiple People Entry")
            print("=" * 55)
            print()


    # Reset group alert when group has dispersed
    if len(recent_entry_ids) < 2:

        last_group_alert_ids = set()


    # ==========================================
    # CLEAN UP PEOPLE WHO LEFT
    # ==========================================

    people_who_left = (
        previous_inside_ids
        - current_inside_ids
    )


    for track_id in people_who_left:

        dwell_start_times.pop(
            track_id,
            None
        )

        dwell_alerted_ids.discard(
            track_id
        )


    # ==========================================
    # UPDATE PREVIOUS STATE
    # ==========================================

    previous_inside_ids = current_inside_ids.copy()


    # ==========================================
    # DISPLAY COUNTERS
    # ==========================================

    cv2.putText(
        frame,
        f"PERSONS: {person_count}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 0, 255),
        2
    )

    cv2.putText(
        frame,
        f"INSIDE ZONE: {current_breaches}",
        (20, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 0, 255),
        2
    )


    # ==========================================
    # WARNING
    # ==========================================

    if current_breaches > 0:

        cv2.putText(
            frame,
            "!!! BORDER INTRUSION !!!",
            (20, 120),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 0, 255),
            3
        )


    # ==========================================
    # SHOW
    # ==========================================

    cv2.imshow(
        "IBVAP - AI Human Analysis",
        frame
    )


    # ==========================================
    # EXIT
    # ==========================================

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q") or key == 27:
        break


# ==========================================
# CLEANUP
# ==========================================

cap.release()
cv2.destroyAllWindows()