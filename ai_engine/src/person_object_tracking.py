import cv2
import time
from datetime import datetime
import numpy as np
import os
import json
import sys

try:
    from threat_engine import calculate_threat_score, is_night_time
except ImportError:
    from src.threat_engine import calculate_threat_score, is_night_time

try:
    from vehicle_detection import (
        extract_vehicles_from_results,
        draw_vehicle_detections,
        VehicleTrackerManager,
        VEHICLE_CLASSES
    )
except ImportError:
    from src.vehicle_detection import (
        extract_vehicles_from_results,
        draw_vehicle_detections,
        VehicleTrackerManager,
        VEHICLE_CLASSES
    )

try:
    from number_plate_detection import process_number_plate, VehiclePlateState
except ImportError:
    from src.number_plate_detection import process_number_plate, VehiclePlateState

try:
    from event_manager import EventManager
except ImportError:
    from src.event_manager import EventManager

try:
    from incident_recorder import IncidentRecorder
except ImportError:
    from src.incident_recorder import IncidentRecorder







from ultralytics import YOLO

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


# ============================================================
# CONFIGURATION
# ============================================================

YOLO_MODEL = "yolo11n.pt"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)

incident_recorder = IncidentRecorder(base_dir=BASE_DIR)

event_manager = EventManager(
    base_dir=BASE_DIR,
    incident_recorder=incident_recorder
)




possible_hand_models = [
    os.path.join(BASE_DIR, "models", "hand_landmarker.task"),
    os.path.join("ai_engine", "models", "hand_landmarker.task"),
    os.path.join("models", "hand_landmarker.task")
]

HAND_MODEL = None
for hp in possible_hand_models:
    if os.path.exists(hp):
        HAND_MODEL = hp
        break
if HAND_MODEL is None:
    HAND_MODEL = "models/hand_landmarker.task"

CONFIDENCE_THRESHOLD = 0.25

# Restricted zone - Loaded dynamically from config/zone.json


possible_config_paths = [
    os.path.join(BASE_DIR, "config", "zone.json"),
    os.path.join("config", "zone.json"),
    os.path.join("ai_engine", "config", "zone.json")
]

CONFIG_PATH = None
for path in possible_config_paths:
    if os.path.exists(path):
        CONFIG_PATH = path
        break

if CONFIG_PATH is None:
    print("Zone configuration not found. Run zone_calibration.py first.")
    sys.exit(1)

try:
    with open(CONFIG_PATH, "r") as f:
        zone_data = json.load(f)

    raw_points = zone_data.get("zone", [])
    if len(raw_points) < 3:
        print("Zone configuration not found. Run zone_calibration.py first.")
        sys.exit(1)

    ZONE = [tuple(pt) for pt in raw_points]
    print(f"✅ Zone loaded successfully from {CONFIG_PATH} ({len(ZONE)} points)")

except Exception as e:
    print("Zone configuration not found. Run zone_calibration.py first.")
    sys.exit(1)


# Dwell threshold
DWELL_THRESHOLD = 30

# People entering within this period = group entry
GROUP_ENTRY_WINDOW = 5

# Only analyze these object classes
OBJECT_CLASSES = {
    24: "backpack",
    26: "handbag",
    28: "suitcase",
}


# ============================================================
# THREAT SCORE CONFIGURATION
# ============================================================
# Threat weights and rules managed in threat_engine.py




# ============================================================
# LOAD YOLO
# ============================================================

model = YOLO(YOLO_MODEL)


# ============================================================
# LOAD MEDIAPIPE HAND LANDMARKER
# ============================================================

base_options = python.BaseOptions(
    model_asset_path=HAND_MODEL
)

hand_options = vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=4,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5
)

hand_detector = vision.HandLandmarker.create_from_options(
    hand_options
)


# ============================================================
# CAMERA
# ============================================================

CAMERA_SOURCE = "http://100.98.199.171:8080/video"

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise RuntimeError("Could not open camera")


# ============================================================
# STATE
# ============================================================

breached_ids = set()

dwell_start_times = {}

dwell_alerted_ids = set()

previous_inside_ids = set()

entry_times = {}

last_group_alert_ids = set()

# Carried-object persistence and temporal motion state
carried_frames = {}
person_object_motion_state = {}
CARRY_CONFIRM_FRAMES = 5
prev_carried_status = None

# Zone intrusion configuration and state tracking
ZONE_TOLERANCE = 10
ZONE_OVERLAP_THRESHOLD = 0.15
ZONE_CONFIRM_FRAMES = 3

zone_frames = {}
previous_foot_positions = {}
confirmed_intrusion_ids = set()

# Per-person threat state tracking
person_threat_results = {}
prev_person_threat_scores = {}

# Vehicle & Number Plate Temporal Tracker Managers
vehicle_tracker_manager = VehicleTrackerManager()
vehicle_plate_states = {}
prev_stable_vehicle_states = {}

PLATE_CHECK_INTERVAL = 3
frame_counter = 0







def boxes_overlap(box_a, box_b):
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    return not (
        ax2 < bx1 or
        ax1 > bx2 or
        ay2 < by1 or
        ay1 > by2
    )


def bbox_overlaps_zone(bbox, zone_points, min_overlap_ratio=0.15):
    x1, y1, x2, y2 = bbox
    box_w = max(1, x2 - x1)
    box_h = max(1, y2 - y1)
    box_area = box_w * box_h

    # Quick check: center point inside zone
    center_x = (x1 + x2) // 2
    center_y = (y1 + y2) // 2
    if cv2.pointPolygonTest(zone_points, (center_x, center_y), False) >= 0:
        return True

    # Bounding rect of zone polygon
    zx, zy, zw, zh = cv2.boundingRect(zone_points)
    ix1 = max(x1, zx)
    iy1 = max(y1, zy)
    ix2 = min(x2, zx + zw)
    iy2 = min(y2, zy + zh)

    if ix2 <= ix1 or iy2 <= iy1:
        return False

    roi_w = ix2 - ix1
    roi_h = iy2 - iy1

    box_mask = np.zeros((roi_h, roi_w), dtype=np.uint8)
    box_mask[:, :] = 255

    zone_sub = zone_points - np.array([ix1, iy1], dtype=np.int32)
    zone_mask = np.zeros((roi_h, roi_w), dtype=np.uint8)
    cv2.fillPoly(zone_mask, [zone_sub], 255)

    intersection = cv2.bitwise_and(box_mask, zone_mask)
    intersection_area = np.count_nonzero(intersection)

    return (intersection_area / float(box_area)) >= min_overlap_ratio



def check_movement_consistency(
    curr_person_center,
    curr_object_center,
    prev_person_center,
    prev_object_center
):
    if prev_person_center is None or prev_object_center is None:
        return True

    px, py = curr_person_center
    prev_px, prev_py = prev_person_center
    ox, oy = curr_object_center
    prev_ox, prev_oy = prev_object_center

    person_dx = px - prev_px
    person_dy = py - prev_py
    object_dx = ox - prev_ox
    object_dy = oy - prev_oy

    person_dist = (person_dx ** 2 + person_dy ** 2) ** 0.5
    object_dist = (object_dx ** 2 + object_dy ** 2) ** 0.5

    # 1. Person is moving (>= 3.0 pixels per frame)
    if person_dist >= 3.0:
        # Object is stationary while person moves -> Not carried (stationary on floor!)
        if object_dist < 1.5:
            return False

        # Difference between movement vectors
        vec_diff = ((person_dx - object_dx) ** 2 + (person_dy - object_dy) ** 2) ** 0.5
        if vec_diff > 25.0:
            return False

        return True

    # 2. Person is nearly stationary (< 3.0 pixels per frame)
    else:
        if object_dist >= 3.0:
            return False

        return True



# FPS tracking for rolling frame buffer and video clip writer
actual_fps = 30.0
last_fps_time = time.time()
fps_frame_count = 0

# ============================================================
# MAIN LOOP
# ============================================================

while True:

    ret, frame = cap.read()

    if not ret:
        print("Could not read frame")
        break

    frame_height, frame_width, _ = frame.shape
    current_time = time.time()

    # Dynamic FPS calculation
    fps_frame_count += 1
    elapsed_fps_time = current_time - last_fps_time
    if elapsed_fps_time >= 1.0:
        actual_fps = max(1.0, fps_frame_count / elapsed_fps_time)
        fps_frame_count = 0
        last_fps_time = current_time

    # Continuous rolling memory buffer update
    incident_recorder.update_buffer(frame, actual_fps=actual_fps)



    # ========================================================
    # HAND DETECTION
    # ========================================================

    rgb_frame = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb_frame
    )

    hand_result = hand_detector.detect(mp_image)


    # ========================================================
    # STORE HAND CENTERS
    # ========================================================

    hand_centers = []

    for hand_landmarks in hand_result.hand_landmarks:

        wrist = hand_landmarks[0]

        hand_x = int(wrist.x * frame_width)
        hand_y = int(wrist.y * frame_height)

        hand_centers.append(
            (hand_x, hand_y)
        )


    # ========================================================
    # DRAW HANDS
    # ========================================================

    for hand_landmarks in hand_result.hand_landmarks:

        for landmark in hand_landmarks:

            x = int(landmark.x * frame_width)
            y = int(landmark.y * frame_height)

            cv2.circle(
                frame,
                (x, y),
                3,
                (0, 0, 255),
                -1
            )


    # ========================================================
    # YOLO TRACKING
    # ========================================================

    results = model.track(
        frame,
        persist=True,
        tracker="bytetrack.yaml",
        conf=0.20,
        iou=0.50,
        imgsz=960,
        verbose=False
    )


    person_count = 0
    current_inside_ids = set()
    tracked_person_bboxes = {}

    detected_objects = []



    # ========================================================
    # PROCESS YOLO RESULTS
    # ========================================================

    for result in results:

        for box in result.boxes:

            confidence = float(box.conf[0])

            class_id = int(box.cls[0])

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )


            # ==================================================
            # PERSON
            # ==================================================

            if class_id == 0:

                if box.id is None:
                    continue

                track_id = int(box.id[0])
                tracked_person_bboxes[track_id] = [x1, y1, x2, y2]

                person_count += 1



                # ----------------------------------------------
                # PERSON CENTER
                # ----------------------------------------------

                person_center_x = int(
                    (x1 + x2) / 2
                )

                person_center_y = int(
                    (y1 + y2) / 2
                )


                # ----------------------------------------------
                # MULTI-SIGNAL GEOMETRIC ZONE CHECK
                # ----------------------------------------------

                zone_np = np.array(ZONE, np.int32)

                # A. Feet point & current position
                foot_x = int((x1 + x2) / 2)
                foot_y = int(y2)
                current_foot = (foot_x, foot_y)

                person_center_x = int((x1 + x2) / 2)
                person_center_y = int((y1 + y2) / 2)
                person_box = (x1, y1, x2, y2)

                # B. Feet-point test with boundary tolerance (ZONE_TOLERANCE = 10)
                feet_dist = cv2.pointPolygonTest(zone_np, current_foot, True)
                inside_by_feet = (feet_dist >= -ZONE_TOLERANCE)

                # C. Bounding-box overlap test (ZONE_OVERLAP_THRESHOLD = 0.15)
                meaningful_bbox_overlap = bbox_overlaps_zone(
                    person_box,
                    zone_np,
                    min_overlap_ratio=ZONE_OVERLAP_THRESHOLD
                )

                # D. Entry crossing signal (previous foot vs current foot)
                previous_foot = previous_foot_positions.get(track_id)
                if previous_foot is not None:
                    prev_feet_dist = cv2.pointPolygonTest(zone_np, previous_foot, True)
                    prev_feet_inside = (prev_feet_dist >= -ZONE_TOLERANCE)
                    confirmed_boundary_crossing = (not prev_feet_inside) and inside_by_feet
                else:
                    confirmed_boundary_crossing = False

                previous_foot_positions[track_id] = current_foot

                # Combined raw geometric signal
                raw_intrusion_signal = (
                    inside_by_feet or meaningful_bbox_overlap or confirmed_boundary_crossing
                )

                # E. Temporal persistence confirmation
                if raw_intrusion_signal:
                    zone_frames[track_id] = zone_frames.get(track_id, 0) + 1
                else:
                    zone_frames[track_id] = max(0, zone_frames.get(track_id, 0) - 1)

                inside_zone = (zone_frames[track_id] >= ZONE_CONFIRM_FRAMES)


                # ----------------------------------------------
                # BREACH & TRANSITION LOGGING
                # ----------------------------------------------

                if inside_zone:

                    current_inside_ids.add(track_id)

                    if track_id not in previous_inside_ids:

                        entry_times[track_id] = current_time

                        dwell_start_times[track_id] = current_time

                    if track_id not in confirmed_intrusion_ids:

                        confirmed_intrusion_ids.add(track_id)

                        timestamp = datetime.now().strftime(
                            "%Y-%m-%d %H:%M:%S"
                        )

                        print()
                        print("=" * 60)
                        print("🚨 BORDER INTRUSION DETECTED")
                        print(f"Track ID   : {track_id}")
                        print(f"Confidence : {confidence:.2f}")
                        print(f"Time       : {timestamp}")
                        print("Event      : Restricted Zone Breach")
                        print("=" * 60)

                else:
                    if track_id in confirmed_intrusion_ids:
                        confirmed_intrusion_ids.remove(track_id)



                # ----------------------------------------------
                # DWELL TIME
                # ----------------------------------------------

                dwell_time = 0

                if track_id in dwell_start_times:

                    dwell_time = (
                        current_time
                        - dwell_start_times[track_id]
                    )


                if (
                    inside_zone
                    and
                    dwell_time >= DWELL_THRESHOLD
                    and
                    track_id not in dwell_alerted_ids
                ):

                    dwell_alerted_ids.add(track_id)

                    timestamp = datetime.now().strftime(
                        "%Y-%m-%d %H:%M:%S"
                    )

                    print()
                    print("=" * 60)
                    print("⚠️ LONG DWELL DETECTED")
                    print(f"Track ID   : {track_id}")
                    print(f"Dwell Time : {dwell_time:.1f} seconds")
                    print(f"Time       : {timestamp}")
                    print("Event      : Extended Presence")
                    print("=" * 60)


                # ----------------------------------------------
                # FIND NEAREST HAND
                # ----------------------------------------------

                nearest_hand = None
                nearest_distance = float("inf")

                for hand_x, hand_y in hand_centers:

                    distance = (
                        (hand_x - person_center_x) ** 2
                        +
                        (hand_y - person_center_y) ** 2
                    ) ** 0.5

                    if distance < nearest_distance:

                        nearest_distance = distance

                        nearest_hand = (
                            hand_x,
                            hand_y
                        )


                # ----------------------------------------------
                # HAND ASSOCIATION
                # ----------------------------------------------

                hand_detected = False

                if nearest_hand is not None:

                    hand_x, hand_y = nearest_hand

                    margin = 100

                    hand_detected = (
                        x1 - margin <= hand_x <= x2 + margin
                        and
                        y1 - margin <= hand_y <= y2 + margin
                    )


                # ----------------------------------------------
                # DRAW PERSON
                # ----------------------------------------------

                zone_points = np.array(ZONE, np.int32)

                cv2.polylines(
                    frame,
                    [zone_points],
                    True,
                    (255, 255, 0),
                    3
                )

                cv2.putText(
                    frame,
                    "DETECTION ZONE",
                    (ZONE[0][0], ZONE[0][1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 0),
                    2
                )

                status_str = "INTRUSION" if inside_zone else "NORMAL"
                label = (
                    f"PERSON #{track_id} "
                    f"| {confidence:.2f} "
                    f"| {status_str}"
                )

                cv2.putText(
                    frame,
                    label,
                    (x1, max(y1 - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.60,
                    (0, 0, 255) if inside_zone else (0, 255, 0),
                    2
                )

                # Draw feet point
                cv2.circle(
                    frame,
                    (foot_x, foot_y),
                    4,
                    (0, 0, 255) if inside_zone else (0, 255, 0),
                    -1
                )



                # ----------------------------------------------
                # HAND STATUS
                # ----------------------------------------------

                if hand_detected:

                    cv2.putText(
                        frame,
                        "HAND: DETECTED",
                        (x1, y2 + 25),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.55,
                        (0, 0, 255),
                        2
                    )

                    cv2.line(
                        frame,
                        (
                            person_center_x,
                            person_center_y
                        ),
                        nearest_hand,
                        (0, 0, 255),
                        1
                    )

                else:

                    cv2.putText(
                        frame,
                        "HAND: NOT DETECTED",
                        (x1, y2 + 25),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.55,
                        (0, 0, 255),
                        2
                    )


                # ----------------------------------------------
                # DWELL DISPLAY
                # ----------------------------------------------

                if inside_zone:

                    cv2.putText(
                        frame,
                        f"DWELL: {dwell_time:.1f}s",
                        (x1, y2 + 50),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.55,
                        (0, 0, 255),
                        2
                    )


            # ==================================================
            # KNIFE / SCISSORS
            # ==================================================

            elif class_id in OBJECT_CLASSES:

                object_name = OBJECT_CLASSES[class_id]

                detected_objects.append({
                    "name": object_name,
                    "confidence": confidence,
                    "bbox": (x1, y1, x2, y2)
                })


    # ========================================================
    # OBJECT → PERSON ASSOCIATION / CARRIED OBJECT
    # ========================================================

    current_associations = {}

    for obj in detected_objects:

        ox1, oy1, ox2, oy2 = obj["bbox"]
        object_box = (ox1, oy1, ox2, oy2)
        object_center = (int((ox1 + ox2) / 2), int((oy1 + oy2) / 2))

        closest_person = None
        closest_distance = float("inf")
        closest_person_center = None

        for result in results:

            for box in result.boxes:

                if int(box.cls[0]) != 0:
                    continue

                if box.id is None:
                    continue

                px1, py1, px2, py2 = map(int, box.xyxy[0])

                person_id = int(box.id[0])
                person_box = (px1, py1, px2, py2)
                person_center = (int((px1 + px2) / 2), int((py1 + py2) / 2))

                distance = (
                    (object_center[0] - person_center[0]) ** 2
                    + (object_center[1] - person_center[1]) ** 2
                ) ** 0.5

                if boxes_overlap(object_box, person_box):
                    if closest_person is None or distance < closest_distance:
                        closest_person = person_id
                        closest_distance = distance
                        closest_person_center = person_center

        if closest_person is not None:

            current_associations[closest_person] = (object_center, closest_person_center)

            cv2.rectangle(
                frame,
                (ox1, oy1),
                (ox2, oy2),
                (0, 165, 255),
                2
            )

            cv2.putText(
                frame,
                f"OBJECT {obj['confidence']:.2f}",
                (ox1, max(oy1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.60,
                (0, 165, 255),
                2
            )

    active_person_ids = set()

    for result in results:
        for box in result.boxes:
            if int(box.cls[0]) == 0 and box.id is not None:
                active_person_ids.add(int(box.id[0]))

    for person_id in active_person_ids:
        if person_id in current_associations:
            curr_obj_center, curr_person_center = current_associations[person_id]

            if person_id in person_object_motion_state:
                prev_p_center = person_object_motion_state[person_id]["prev_person_center"]
                prev_o_center = person_object_motion_state[person_id]["prev_object_center"]

                is_consistent = check_movement_consistency(
                    curr_person_center,
                    curr_obj_center,
                    prev_p_center,
                    prev_o_center
                )
            else:
                is_consistent = True

            person_object_motion_state[person_id] = {
                "prev_person_center": curr_person_center,
                "prev_object_center": curr_obj_center,
            }

            if is_consistent:
                carried_frames[person_id] = (
                    carried_frames.get(person_id, 0) + 1
                )
            else:
                carried_frames[person_id] = 0
        else:
            carried_frames[person_id] = 0
            person_object_motion_state.pop(person_id, None)

    carried_person_ids = set()
    for person_id, frame_count in carried_frames.items():
        if frame_count >= CARRY_CONFIRM_FRAMES:
            carried_person_ids.add(person_id)

    for person_id in list(carried_frames.keys()):
        if person_id not in active_person_ids:
            del carried_frames[person_id]
            person_object_motion_state.pop(person_id, None)

    for person_id in list(person_object_motion_state.keys()):
        if person_id not in active_person_ids:
            del person_object_motion_state[person_id]

    for track_id in list(zone_frames.keys()):
        if track_id not in active_person_ids:
            del zone_frames[track_id]

    for track_id in list(previous_foot_positions.keys()):
        if track_id not in active_person_ids:
            del previous_foot_positions[track_id]

    for track_id in list(confirmed_intrusion_ids):
        if track_id not in active_person_ids:
            confirmed_intrusion_ids.remove(track_id)

    for track_id in list(prev_person_threat_scores.keys()):
        if track_id not in active_person_ids:
            del prev_person_threat_scores[track_id]




    carried_object = bool(carried_person_ids)
    carried_status = "YES" if carried_object else "NO"

    if carried_status != prev_carried_status:
        print(f"CARRIED OBJECT : {carried_status}")
        prev_carried_status = carried_status



    # ========================================================
    # GROUP ENTRY
    # ========================================================

    expired_ids = []

    for track_id, entry_time in entry_times.items():

        if current_time - entry_time > GROUP_ENTRY_WINDOW:

            expired_ids.append(track_id)


    for track_id in expired_ids:

        del entry_times[track_id]


    recent_entry_ids = set(entry_times.keys())


    if len(recent_entry_ids) >= 2:

        if recent_entry_ids != last_group_alert_ids:

            last_group_alert_ids = recent_entry_ids.copy()

            timestamp = datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            )

            print()
            print("=" * 60)
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
            print("=" * 60)


    if len(recent_entry_ids) < 2:

        last_group_alert_ids = set()


    # ========================================================
    # CLEANUP LEFT PEOPLE
    # ========================================================

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


    previous_inside_ids = current_inside_ids.copy()


    # ========================================================
    # RESTRICTED ZONE
    # ========================================================

    zone_points = np.array(ZONE, np.int32)

    cv2.polylines(
        frame,
        [zone_points],
        True,
        (255, 255, 0),
        3
    )

    cv2.putText(
        frame,
        "RESTRICTED ZONE",
        (ZONE[0][0], ZONE[0][1] - 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 0),
        2
    )


    # ========================================================
    # VEHICLE DETECTION & TEMPORAL STABILITY
    # ========================================================

    detected_vehicles = extract_vehicles_from_results(results, conf_threshold=0.35)
    confirmed_vehicles = vehicle_tracker_manager.update(detected_vehicles)
    frame = draw_vehicle_detections(frame, confirmed_vehicles)



    # ========================================================
    # NUMBER PLATE DETECTION & MULTI-FRAME OCR AGGREGATION
    # ========================================================

    frame_counter += 1
    active_v_ids = set()
    latest_plate_country = "UNKNOWN"

    for v in confirmed_vehicles:
        v_id = v["id"]
        v_type = v["type"]
        v_bbox = v["bbox"]
        active_v_ids.add(v_id)

        if v_id not in vehicle_plate_states:
            vehicle_plate_states[v_id] = VehiclePlateState(v_id)

        p_state = vehicle_plate_states[v_id]

        should_run_ocr = (frame_counter % PLATE_CHECK_INTERVAL == 0)
        if p_state.confirmed_plate and p_state.stable_country in ["INDIA", "NON_INDIA"]:
            should_run_ocr = (frame_counter % 15 == 0)

        raw_p_info = None
        if should_run_ocr:
            raw_p_info = process_number_plate(
                frame, v_bbox, vehicle_type=v_type, vehicle_id=v_id, frame_counter=frame_counter
            )
            p_state.add_ocr_sample(
                raw_p_info["plate_number"],
                raw_p_info["plate_country"],
                raw_p_info["plate_confidence"],
                raw_p_info["plate_bbox"],
                sharpness=raw_p_info.get("sharpness", 0.0),
                quality_score=raw_p_info.get("quality_score", 0.0)
            )

        stable_p_info = p_state.to_dict(vehicle_type=v_type)

        if stable_p_info.get("plate_bbox"):
            px1, py1, px2, py2 = stable_p_info["plate_bbox"]
            p_country = stable_p_info.get("plate_country", "UNKNOWN")
            p_num = stable_p_info.get("plate_number", "UNKNOWN")

            p_color = (0, 255, 0) if p_country == "INDIA" else ((0, 255, 255) if p_country == "NON_INDIA" else (0, 165, 255))
            cv2.rectangle(frame, (px1, py1), (px2, py2), p_color, 2)

            plate_label = f"PLATE: {p_num} ({p_country})"
            cv2.putText(
                frame,
                plate_label,
                (px1, max(py1 - 8, 15)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                p_color,
                2
            )

        curr_v_state = (v_type, stable_p_info["plate_number"], stable_p_info["plate_country"])
        prev_v_state = prev_stable_vehicle_states.get(v_id)

        if curr_v_state != prev_v_state or (raw_p_info and raw_p_info.get("candidate_found")):
            prev_stable_vehicle_states[v_id] = curr_v_state

            cand_found = raw_p_info.get("candidate_found", False) if raw_p_info else (stable_p_info.get("plate_bbox") is not None)
            plate_bbox_str = f"({stable_p_info['plate_bbox'][0]}, {stable_p_info['plate_bbox'][1]}, {stable_p_info['plate_bbox'][2]}, {stable_p_info['plate_bbox'][3]})" if stable_p_info.get("plate_bbox") else "N/A"

            if stable_p_info.get("plate_bbox"):
                pw = stable_p_info["plate_bbox"][2] - stable_p_info["plate_bbox"][0]
                ph = stable_p_info["plate_bbox"][3] - stable_p_info["plate_bbox"][1]
                plate_size_str = f"{pw}x{ph}"
            else:
                plate_size_str = "N/A"

            raw_ocr_res = raw_p_info.get("raw_ocr_result", "EMPTY") if raw_p_info else "N/A"
            ocr_conf = raw_p_info.get("plate_confidence", 0.0) if raw_p_info else stable_p_info.get("plate_confidence", 0.0)
            ocr_attempted = "YES" if cand_found else "NO"

            print("========================================")
            print(f"DIAGNOSTIC REPORT - VEHICLE #{v_id}")
            print("========================================")
            print(f"VEHICLE ID       : {v_id}")
            print(f"VEHICLE TYPE     : {v_type.upper()}")
            print(f"VEHICLE BBOX     : ({v_bbox[0]}, {v_bbox[1]}, {v_bbox[2]}, {v_bbox[3]})")
            print(f"PLATE CANDIDATE  : {'FOUND' if cand_found else 'NOT FOUND'}")
            print(f"PLATE BBOX       : {plate_bbox_str}")
            print(f"PLATE SIZE       : {plate_size_str}")
            print(f"OCR ATTEMPTED    : {ocr_attempted}")
            print(f"OCR RAW RESULT   : {raw_ocr_res}")
            print(f"OCR CONFIDENCE   : {ocr_conf}")
            print(f"FINAL PLATE      : {stable_p_info['plate_number']}")
            print(f"COUNTRY          : {stable_p_info['plate_country']}")
            print("========================================")




        if stable_p_info["plate_country"] in ["INDIA", "NON_INDIA"]:
            latest_plate_country = stable_p_info["plate_country"]
        elif latest_plate_country == "UNKNOWN":
            latest_plate_country = stable_p_info.get("plate_country", "UNKNOWN")

    # Clean up stale vehicle plate states
    for v_id in list(vehicle_plate_states.keys()):
        if v_id not in active_v_ids:
            vehicle_plate_states[v_id].mark_missed()
            if vehicle_plate_states[v_id].is_expired():
                del vehicle_plate_states[v_id]
                prev_stable_vehicle_states.pop(v_id, None)



    # ========================================================
    # THREAT ENGINE CALCULATION (PER-PERSON)
    # ========================================================


    night_time = is_night_time()
    vehicle_present = (len(detected_vehicles) > 0)
    person_threat_results = {}

    for track_id in active_person_ids:
        p_intrusion = (track_id in current_inside_ids)
        p_carried = (track_id in carried_person_ids)
        p_dwell = (track_id in dwell_alerted_ids)
        p_group = (track_id in recent_entry_ids and len(recent_entry_ids) >= 2)

        threat_res = calculate_threat_score(
            intrusion=p_intrusion,
            carried_object=p_carried,
            night_time=night_time,
            long_dwell=p_dwell,
            group_entry=p_group,
            person_id=track_id,
            vehicle_present=vehicle_present,
            plate_country=latest_plate_country
        )



        person_threat_results[track_id] = threat_res

        # Print terminal alert on score change
        prev_score = prev_person_threat_scores.get(track_id)
        curr_score = threat_res["score"]

        if prev_score != curr_score:
            prev_person_threat_scores[track_id] = curr_score
            factors_str = ", ".join(threat_res["factors"]) if threat_res["factors"] else "None"
            print(f"PERSON ID     : {track_id}")
            print(f"THREAT SCORE  : {threat_res['score']}")
            print(f"THREAT LEVEL  : {threat_res['level']}")
            print(f"RISK FACTORS  : {factors_str}")
            print("-" * 40)

    # ========================================================
    # SECURITY EVENT & EVIDENCE GENERATION
    # ========================================================

    # 1. PERSON_ZONE_BREACH Event
    for track_id in current_inside_ids:
        if not event_manager.is_event_active("PERSON_ZONE_BREACH", track_id):
            event_manager.mark_event_active("PERSON_ZONE_BREACH", track_id)
            p_bbox = tracked_person_bboxes.get(track_id)
            t_score = person_threat_results.get(track_id, {}).get("score", 30)
            evt = event_manager.create_event(
                event_type="PERSON_ZONE_BREACH",
                frame=frame,
                person_data={
                    "person_id": track_id,
                    "person_bbox": p_bbox,
                    "zone_status": "BREACH"
                },
                zone_data={
                    "zone_points": ZONE,
                    "zone_status": "BREACH"
                },
                threat_score=t_score
            )
            incident_recorder.trigger_clip(
                event_id=evt["event_id"],
                event_type=evt["event_type"],
                actual_fps=actual_fps,
                frame_size=(frame_width, frame_height)
            )

    for track_id in people_who_left:
        event_manager.clear_event_state("PERSON_ZONE_BREACH", track_id)

    # 2. CARRIED_OBJECT Event
    for track_id in carried_person_ids:
        if not event_manager.is_event_active("CARRIED_OBJECT", track_id):
            event_manager.mark_event_active("CARRIED_OBJECT", track_id)
            p_bbox = tracked_person_bboxes.get(track_id)
            obj_info = person_object_motion_state.get(track_id, {})
            obj_name = obj_info.get("object_type", "backpack")
            t_score = person_threat_results.get(track_id, {}).get("score", 25)
            evt = event_manager.create_event(
                event_type="CARRIED_OBJECT",
                frame=frame,
                person_data={
                    "person_id": track_id,
                    "person_bbox": p_bbox,
                    "zone_status": "BREACH" if track_id in current_inside_ids else "OUTSIDE"
                },
                object_data={
                    "object_detected": True,
                    "object_name": obj_name,
                    "object_confidence": 0.85,
                    "carried_object": True
                },
                threat_score=t_score
            )
            incident_recorder.trigger_clip(
                event_id=evt["event_id"],
                event_type=evt["event_type"],
                actual_fps=actual_fps,
                frame_size=(frame_width, frame_height)
            )

    for track_id in list(active_person_ids):
        if track_id not in carried_person_ids:
            event_manager.clear_event_state("CARRIED_OBJECT", track_id)

    # 3. GROUP_ENTRY Event
    if len(recent_entry_ids) >= 2:
        group_key = tuple(sorted(recent_entry_ids))
        if not event_manager.is_event_active("GROUP_ENTRY", group_key):
            event_manager.mark_event_active("GROUP_ENTRY", group_key)
            t_scores = [person_threat_results.get(pid, {}).get("score", 15) for pid in recent_entry_ids]
            max_group_threat = max(t_scores, default=15)
            first_pid = sorted(recent_entry_ids)[0]
            p_bbox = tracked_person_bboxes.get(first_pid)
            evt = event_manager.create_event(
                event_type="GROUP_ENTRY",
                frame=frame,
                person_data={
                    "person_id": first_pid,
                    "person_bbox": p_bbox,
                    "zone_status": "BREACH"
                },
                zone_data={
                    "zone_points": ZONE,
                    "zone_status": "BREACH"
                },
                threat_score=max_group_threat
            )
            incident_recorder.trigger_clip(
                event_id=evt["event_id"],
                event_type=evt["event_type"],
                actual_fps=actual_fps,
                frame_size=(frame_width, frame_height)
            )
    else:
        for event_tuple in list(event_manager.active_events):
            if event_tuple[0] == "GROUP_ENTRY":
                event_manager.active_events.discard(event_tuple)

    # 4. DWELL_TIME Event
    for track_id in dwell_alerted_ids:
        if not event_manager.is_event_active("DWELL_TIME", track_id):
            event_manager.mark_event_active("DWELL_TIME", track_id)
            p_bbox = tracked_person_bboxes.get(track_id)
            t_score = person_threat_results.get(track_id, {}).get("score", 15)
            evt = event_manager.create_event(
                event_type="DWELL_TIME",
                frame=frame,
                person_data={
                    "person_id": track_id,
                    "person_bbox": p_bbox,
                    "zone_status": "BREACH"
                },
                zone_data={
                    "zone_points": ZONE,
                    "zone_status": "BREACH"
                },
                threat_score=t_score
            )
            incident_recorder.trigger_clip(
                event_id=evt["event_id"],
                event_type=evt["event_type"],
                actual_fps=actual_fps,
                frame_size=(frame_width, frame_height)
            )

    # 5. VEHICLE_DETECTED Event
    for v in confirmed_vehicles:
        v_id = v["id"]
        if not event_manager.is_event_active("VEHICLE_DETECTED", v_id):
            event_manager.mark_event_active("VEHICLE_DETECTED", v_id)
            p_state = vehicle_plate_states.get(v_id)
            stable_p_info = p_state.to_dict(vehicle_type=v["type"]) if p_state else {}
            v_country = stable_p_info.get("plate_country", "UNKNOWN")
            v_threat = 10 + (25 if v_country in ["NON_INDIA", "UNKNOWN"] else 0)
            evt = event_manager.create_event(
                event_type="VEHICLE_DETECTED",
                frame=frame,
                vehicle_data={
                    "vehicle_id": v_id,
                    "vehicle_type": v["type"],
                    "vehicle_bbox": v["bbox"],
                    "plate_number": stable_p_info.get("plate_number") if stable_p_info.get("plate_number") != "UNKNOWN" else None,
                    "plate_country": v_country,
                    "plate_confidence": stable_p_info.get("plate_confidence", 0.0),
                    "plate_bbox": stable_p_info.get("plate_bbox")
                },
                threat_score=v_threat
            )
            incident_recorder.trigger_clip(
                event_id=evt["event_id"],
                event_type=evt["event_type"],
                actual_fps=actual_fps,
                frame_size=(frame_width, frame_height)
            )





    # ========================================================
    # GLOBAL INFORMATION
    # ========================================================

    cv2.putText(
        frame,
        f"PERSONS: {person_count}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (0, 0, 255),
        2
    )

    cv2.putText(
        frame,
        f"INSIDE ZONE: {len(current_inside_ids)}",
        (20, 75),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (0, 0, 255),
        2
    )

    cv2.putText(
        frame,
        f"HANDS: {len(hand_centers)}",
        (20, 110),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (0, 0, 255),
        2
    )

    cv2.putText(
        frame,
        f"OBJECTS: {len(detected_objects)}",
        (20, 145),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (0, 165, 255),
        2
    )

    cv2.putText(
        frame,
        f"VEHICLES: {len(detected_vehicles)}",
        (20, 180),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (255, 191, 0),
        2
    )

    cv2.putText(
        frame,
        f"CARRIED OBJECT: {carried_status}",
        (20, 220),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (0, 165, 255) if carried_object else (255, 255, 255),
        2
    )


    max_threat = max([r["score"] for r in person_threat_results.values()], default=0)
    max_level = "HIGH" if max_threat >= 60 else ("MEDIUM" if max_threat >= 30 else "LOW")

    cv2.putText(
        frame,
        f"THREAT SCORE: {max_threat} ({max_level})",
        (20, 255),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (0, 0, 255) if max_threat >= 60 else ((0, 165, 255) if max_threat >= 30 else (0, 255, 0)),
        2
    )




    # ========================================================
    # BREACH WARNING
    # ========================================================

    if len(current_inside_ids) > 0:

        cv2.putText(
            frame,
            "!!! BORDER INTRUSION !!!",
            (20, 185),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.85,
            (0, 0, 255),
            3
        )


    # ========================================================
    # DISPLAY
    # ========================================================

    cv2.imshow(
        "IBVAP - Complete AI Prototype",
        frame
    )


    # ========================================================
    # EXIT
    # ========================================================

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q") or key == 27:
        break


# ============================================================
# CLEANUP
# ============================================================

cap.release()
hand_detector.close()
cv2.destroyAllWindows()