import cv2
import time
from datetime import datetime
import numpy as np
import os
import json
import threading
import logging

try:
    from config import settings
    from model_loader import get_model_loader
    from event_manager import EventManager
    from incident_recorder import IncidentRecorder
    from threat_engine import calculate_threat_score, is_night_time
    from vehicle_detection import (
        extract_vehicles_from_results,
        draw_vehicle_detections,
        find_associated_vehicle,
        VehicleTrackerManager,
        VEHICLE_CLASSES
    )
    from number_plate_detection import process_number_plate, VehiclePlateState
except ImportError:
    from src.config import settings
    from src.model_loader import get_model_loader
    from src.event_manager import EventManager
    from src.incident_recorder import IncidentRecorder
    from src.threat_engine import calculate_threat_score, is_night_time
    from src.vehicle_detection import (
        extract_vehicles_from_results,
        draw_vehicle_detections,
        find_associated_vehicle,
        VehicleTrackerManager,
        VEHICLE_CLASSES
    )
    from src.number_plate_detection import process_number_plate, VehiclePlateState

import mediapipe as mp

# Object classes to track
OBJECT_CLASSES = {
    24: "backpack",
    26: "handbag",
    28: "suitcase",
}

DWELL_THRESHOLD = 30
GROUP_ENTRY_WINDOW = 5
ZONE_TOLERANCE = 10
ZONE_OVERLAP_THRESHOLD = 0.15
ZONE_CONFIRM_FRAMES = 3
CARRY_CONFIRM_FRAMES = 5
PLATE_CHECK_INTERVAL = 3


def bbox_overlaps_zone(bbox, zone_points, min_overlap_ratio=0.15):
    if not zone_points or len(zone_points) < 3:
        return False
    x1, y1, x2, y2 = bbox
    box_w = max(1, x2 - x1)
    box_h = max(1, y2 - y1)
    box_area = box_w * box_h

    center_x = (x1 + x2) // 2
    center_y = (y1 + y2) // 2
    if cv2.pointPolygonTest(zone_points, (center_x, center_y), False) >= 0:
        return True

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


def check_movement_consistency(curr_person_center, curr_object_center, prev_person_center, prev_object_center):
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

    if person_dist >= 3.0:
        if object_dist < 1.5:
            return False
        vec_diff = ((person_dx - object_dx) ** 2 + (person_dy - object_dy) ** 2) ** 0.5
        if vec_diff > 25.0:
            return False
        return True
    else:
        if object_dist >= 3.0:
            return False
        return True


class CameraWorker:
    """
    Independent runtime video worker for a single camera.
    Manages video ingestion, pipeline state, zone detection, reconnection logic,
    and event/clip generation for camera_id.
    """

    def __init__(self, camera_config: dict):
        self.camera_id = camera_config["camera_id"]
        self.name = camera_config.get("name", f"Camera {self.camera_id}")
        self.stream_url = camera_config["stream_url"]
        self.camera_type = camera_config.get("camera_type", "ip_webcam")
        self.enabled = camera_config.get("enabled", True)

        raw_zone = camera_config.get("zone", [])
        self.zone = [tuple(pt) for pt in raw_zone] if raw_zone else []

        # Lifecycle State: STOPPED, STARTING, RUNNING, RECONNECTING, ERROR, STOPPING
        self.state = "STOPPED"
        self.error_message = None
        self.last_active = time.time()

        # Threading controls
        self._thread = None
        self._stop_requested = threading.Event()
        self._config_lock = threading.Lock()

        # Isolated AI Subsystems
        self.incident_recorder = IncidentRecorder(camera_id=self.camera_id)
        self.incident_recorder.camera_worker = self
        self.event_manager = EventManager(camera_id=self.camera_id, incident_recorder=self.incident_recorder)
        self.model_loader = get_model_loader()

        # Isolated Per-Camera Tracking State
        self._reset_camera_state()

    def _reset_camera_state(self):
        """Resets camera-specific tracking state."""
        self.breached_ids = set()
        self.dwell_start_times = {}
        self.dwell_alerted_ids = set()
        self.previous_inside_ids = set()
        self.entry_times = {}
        self.last_group_alert_ids = set()

        self.carried_frames = {}
        self.person_object_motion_state = {}
        self.prev_carried_status = None

        self.zone_frames = {}
        self.previous_foot_positions = {}
        self.confirmed_intrusion_ids = set()

        self.person_threat_results = {}
        self.prev_person_threat_scores = {}

        self.vehicle_tracker_manager = VehicleTrackerManager()
        self.vehicle_plate_states = {}
        self.prev_stable_vehicle_states = {}
        self.frame_counter = 0

    def start(self):
        """Starts the worker thread."""
        with self._config_lock:
            if self.state in ("RUNNING", "STARTING", "RECONNECTING"):
                print(f"[{self.camera_id}] Worker already active in state: {self.state}")
                return

            self._stop_requested.clear()
            self.state = "STARTING"
            self.error_message = None
            self._thread = threading.Thread(target=self._run_loop, name=f"Worker-{self.camera_id}", daemon=True)
            self._thread.start()
            print(f"[{self.camera_id}] Worker thread started for {self.name} ({self.stream_url})")

    def stop(self):
        """Stops the worker thread."""
        with self._config_lock:
            if self.state == "STOPPED":
                return
            self.state = "STOPPING"
            self._stop_requested.set()

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)

        self.state = "STOPPED"
        print(f"[{self.camera_id}] Worker stopped successfully")

    def restart(self):
        """Restarts the camera worker."""
        print(f"[{self.camera_id}] Restarting camera worker...")
        self.stop()
        self.start()

    def update_config(self, new_config: dict):
        """Updates camera configuration dynamically (e.g. stream_url)."""
        reconnect_needed = False
        with self._config_lock:
            if "name" in new_config:
                self.name = new_config["name"]
            if "camera_type" in new_config:
                self.camera_type = new_config["camera_type"]
            if "enabled" in new_config:
                self.enabled = new_config["enabled"]
            if "zone" in new_config and new_config["zone"]:
                self.zone = [tuple(pt) for pt in new_config["zone"]]

            if "stream_url" in new_config and new_config["stream_url"] != self.stream_url:
                print(f"[{self.camera_id}] Stream URL changed: {self.stream_url} -> {new_config['stream_url']}")
                self.stream_url = new_config["stream_url"]
                reconnect_needed = True

        if reconnect_needed and self.state in ("RUNNING", "RECONNECTING"):
            self.restart()

    def update_zone(self, zone_points: list):
        """Updates camera restricted zone polygon."""
        with self._config_lock:
            self.zone = [tuple(pt) for pt in zone_points] if zone_points else []
            print(f"[{self.camera_id}] Zone updated ({len(self.zone)} points)")

    def get_status(self) -> dict:
        """Returns current worker status dictionary."""
        return {
            "camera_id": self.camera_id,
            "name": self.name,
            "stream_url": self.stream_url,
            "camera_type": self.camera_type,
            "enabled": self.enabled,
            "state": self.state,
            "error_message": self.error_message,
            "has_zone": len(self.zone) >= 3,
            "zone_points_count": len(self.zone),
            "last_active": datetime.fromtimestamp(self.last_active).isoformat()
        }

    def _run_loop(self):
        """Main processing loop with auto-reconnect backoff logic."""
        cap = None
        consecutive_failures = 0

        while not self._stop_requested.is_set():
            # Check if camera is disabled
            if not self.enabled:
                self.state = "STOPPED"
                time.sleep(1.0)
                continue

            # Connection Attempt
            if cap is None or not cap.isOpened():
                print(f"[{self.camera_id}] Connecting to stream: {self.stream_url}...")
                cap = cv2.VideoCapture(self.stream_url)

                if not cap.isOpened():
                    consecutive_failures += 1
                    self.state = "RECONNECTING" if consecutive_failures < settings.MAX_RECONNECT_ATTEMPTS else "ERROR"
                    self.error_message = f"Failed to open video stream: {self.stream_url}"
                    print(f"[{self.camera_id}] ❌ Stream connect failed (Attempt {consecutive_failures}). Retrying in {settings.RECONNECT_DELAY}s...")
                    time.sleep(settings.RECONNECT_DELAY)
                    continue

                print(f"[{self.camera_id}] ✅ Connected to stream successfully.")
                self.state = "RUNNING"
                self.error_message = None
                consecutive_failures = 0

            # Frame Processing Loop
            ret, frame = cap.read()

            if not ret or frame is None or frame.size == 0:
                print(f"[{self.camera_id}] ⚠️ Stream lost / frame read failed.")
                self.state = "RECONNECTING"
                if cap:
                    cap.release()
                    cap = None
                time.sleep(settings.RECONNECT_DELAY)
                continue

            self.last_active = time.time()

            try:
                self._process_frame(frame)
            except Exception as e:
                print(f"[{self.camera_id}] ⚠️ Frame processing error: {e}")

            # GUI display only if DISPLAY_ENABLED is set to true (debug/dev mode)
            if settings.DISPLAY_ENABLED:
                cv2.imshow(f"IBVAP AI - {self.name} ({self.camera_id})", frame)
                if cv2.waitKey(1) & 0xFF in (ord('q'), 27):
                    self._stop_requested.set()
                    break

        if cap:
            cap.release()
        if settings.DISPLAY_ENABLED:
            cv2.destroyWindow(f"IBVAP AI - {self.name} ({self.camera_id})")

        self.state = "STOPPED"
        print(f"[{self.camera_id}] Worker loop terminated cleanly.")

    def _process_frame(self, frame):
        """Performs detection, tracking, zone check, threat scoring, and event generation for one frame."""
        frame_height, frame_width, _ = frame.shape
        current_time = time.time()
        self.frame_counter += 1

        # Continuous rolling memory buffer update
        self.incident_recorder.update_buffer(frame, actual_fps=30.0)

        # Hand Detection
        hand_centers = []
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        hand_result = self.model_loader.detect_hands(mp_image)

        if hand_result and hand_result.hand_landmarks:
            for hand_landmarks in hand_result.hand_landmarks:
                wrist = hand_landmarks[0]
                hand_x = int(wrist.x * frame_width)
                hand_y = int(wrist.y * frame_height)
                hand_centers.append((hand_x, hand_y))
                if settings.DISPLAY_ENABLED:
                    for landmark in hand_landmarks:
                        lx = int(landmark.x * frame_width)
                        ly = int(landmark.y * frame_height)
                        cv2.circle(frame, (lx, ly), 3, (0, 0, 255), -1)

        # YOLO Tracking
        results = self.model_loader.run_yolo_tracking(frame)

        person_count = 0
        current_inside_ids = set()
        tracked_person_bboxes = {}
        detected_objects = []

        for result in results:
            for box in result.boxes:
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])

                # PERSON
                if class_id == 0:
                    if box.id is None:
                        continue
                    track_id = int(box.id[0])
                    tracked_person_bboxes[track_id] = [x1, y1, x2, y2]
                    person_count += 1

                    # Zone Evaluation
                    zone_np = np.array(self.zone, np.int32) if len(self.zone) >= 3 else None
                    if zone_np is not None:
                        foot_x = int((x1 + x2) / 2)
                        foot_y = int(y2)
                        current_foot = (foot_x, foot_y)
                        person_box = (x1, y1, x2, y2)

                        feet_dist = cv2.pointPolygonTest(zone_np, current_foot, True)
                        inside_by_feet = (feet_dist >= -ZONE_TOLERANCE)
                        meaningful_bbox_overlap = bbox_overlaps_zone(person_box, zone_np, min_overlap_ratio=ZONE_OVERLAP_THRESHOLD)

                        previous_foot = self.previous_foot_positions.get(track_id)
                        if previous_foot is not None:
                            prev_feet_dist = cv2.pointPolygonTest(zone_np, previous_foot, True)
                            prev_feet_inside = (prev_feet_dist >= -ZONE_TOLERANCE)
                            confirmed_boundary_crossing = (not prev_feet_inside) and inside_by_feet
                        else:
                            confirmed_boundary_crossing = False

                        self.previous_foot_positions[track_id] = current_foot
                        raw_intrusion_signal = (inside_by_feet or meaningful_bbox_overlap or confirmed_boundary_crossing)

                        if raw_intrusion_signal:
                            self.zone_frames[track_id] = self.zone_frames.get(track_id, 0) + 1
                        else:
                            self.zone_frames[track_id] = max(0, self.zone_frames.get(track_id, 0) - 1)

                        inside_zone = (self.zone_frames[track_id] >= ZONE_CONFIRM_FRAMES)

                        if inside_zone:
                            current_inside_ids.add(track_id)
                            if track_id not in self.previous_inside_ids:
                                self.entry_times[track_id] = current_time
                                self.dwell_start_times[track_id] = current_time
                            if track_id not in self.confirmed_intrusion_ids:
                                self.confirmed_intrusion_ids.add(track_id)
                        else:
                            if track_id in self.confirmed_intrusion_ids:
                                self.confirmed_intrusion_ids.remove(track_id)

                    # Dwell time
                    dwell_time = 0
                    if track_id in self.dwell_start_times:
                        dwell_time = current_time - self.dwell_start_times[track_id]

                    if track_id in current_inside_ids and dwell_time >= DWELL_THRESHOLD and track_id not in self.dwell_alerted_ids:
                        self.dwell_alerted_ids.add(track_id)

                # CARRIED OBJECTS
                elif class_id in OBJECT_CLASSES:
                    detected_objects.append({
                        "class_id": class_id,
                        "class_name": OBJECT_CLASSES[class_id],
                        "bbox": [x1, y1, x2, y2],
                        "confidence": confidence,
                        "center": ((x1 + x2) // 2, (y1 + y2) // 2)
                    })

        # Vehicle Detection
        vehicle_detections = extract_vehicles_from_results(results)
        confirmed_vehicles = self.vehicle_tracker_manager.update(vehicle_detections)

        # Plate Processing
        if self.frame_counter % PLATE_CHECK_INTERVAL == 0:
            for v in confirmed_vehicles:
                v_id = v["id"]
                v_bbox = v["bbox"]
                if v_id not in self.vehicle_plate_states:
                    self.vehicle_plate_states[v_id] = VehiclePlateState(vehicle_id=v_id, vehicle_type=v["type"])

                plate_res = process_number_plate(frame, v_bbox)
                if plate_res and plate_res.get("plate_detected"):
                    self.vehicle_plate_states[v_id].add_observation(
                        plate_number=plate_res.get("plate_number"),
                        country=plate_res.get("plate_country"),
                        confidence=plate_res.get("confidence", 0.0),
                        plate_bbox=plate_res.get("plate_bbox")
                    )

        # Transition tracking
        people_who_left = self.previous_inside_ids - current_inside_ids
        for pid in people_who_left:
            self.dwell_start_times.pop(pid, None)
            self.dwell_alerted_ids.discard(pid)
            self.previous_foot_positions.pop(pid, None)
            self.zone_frames.pop(pid, None)

        self.previous_inside_ids = current_inside_ids.copy()

        # Group Entry logic
        recent_entry_ids = [
            pid for pid in current_inside_ids
            if (current_time - self.entry_times.get(pid, current_time)) <= GROUP_ENTRY_WINDOW
        ]

        # Carried Object association
        carried_person_ids = set()
        for track_id, p_bbox in tracked_person_bboxes.items():
            px1, py1, px2, py2 = p_bbox
            person_center = ((px1 + px2) // 2, (py1 + py2) // 2)

            is_carrying = False
            associated_obj_type = None

            for obj in detected_objects:
                ox1, oy1, ox2, oy2 = obj["bbox"]
                obj_center = obj["center"]

                in_bbox = (px1 <= obj_center[0] <= px2 and py1 <= obj_center[1] <= py2)

                near_hand = False
                for hx, hy in hand_centers:
                    if (ox1 - 40 <= hx <= ox2 + 40) and (oy1 - 40 <= hy <= oy2 + 40):
                        near_hand = True
                        break

                if in_bbox or near_hand:
                    state_info = self.person_object_motion_state.get(track_id)
                    prev_p_center = state_info.get("prev_person_center") if state_info else None
                    prev_o_center = state_info.get("prev_object_center") if state_info else None

                    if check_movement_consistency(person_center, obj_center, prev_p_center, prev_o_center):
                        is_carrying = True
                        associated_obj_type = obj["class_name"]

                    self.person_object_motion_state[track_id] = {
                        "prev_person_center": person_center,
                        "prev_object_center": obj_center,
                        "object_type": associated_obj_type
                    }
                    break

            if is_carrying:
                self.carried_frames[track_id] = self.carried_frames.get(track_id, 0) + 1
            else:
                self.carried_frames[track_id] = max(0, self.carried_frames.get(track_id, 0) - 1)

            if self.carried_frames[track_id] >= CARRY_CONFIRM_FRAMES:
                carried_person_ids.add(track_id)

        # Threat Score Calculation per person
        night = is_night_time()
        is_group = len(recent_entry_ids) >= 2
        active_person_ids = set(tracked_person_bboxes.keys())

        for track_id in active_person_ids:
            in_zone = track_id in current_inside_ids
            has_carried = track_id in carried_person_ids
            has_long_dwell = track_id in self.dwell_alerted_ids
            in_group = (track_id in recent_entry_ids) if is_group else False
            p_bbox = tracked_person_bboxes.get(track_id)

            # Scored person-to-vehicle spatial association
            assoc_vehicle = find_associated_vehicle(p_bbox, confirmed_vehicles)
            has_vehicle = assoc_vehicle is not None
            assoc_plate_country = None
            assoc_v_data = None

            if has_vehicle:
                v_id = assoc_vehicle["id"]
                p_state = self.vehicle_plate_states.get(v_id)
                if p_state:
                    info = p_state.to_dict(vehicle_type=assoc_vehicle["type"])
                    assoc_plate_country = info.get("plate_country", "UNKNOWN")
                    assoc_v_data = {
                        "vehicle_id": v_id,
                        "vehicle_type": assoc_vehicle["type"],
                        "vehicle_bbox": assoc_vehicle["bbox"],
                        "plate_number": info.get("plate_number") if info.get("plate_number") != "UNKNOWN" else None,
                        "plate_country": assoc_plate_country,
                        "plate_confidence": info.get("plate_confidence", 0.0),
                        "plate_bbox": info.get("plate_bbox")
                    }
                else:
                    assoc_plate_country = "UNKNOWN"
                    assoc_v_data = {
                        "vehicle_id": v_id,
                        "vehicle_type": assoc_vehicle["type"],
                        "vehicle_bbox": assoc_vehicle["bbox"],
                        "plate_number": None,
                        "plate_country": "UNKNOWN",
                        "plate_confidence": 0.0,
                        "plate_bbox": None
                    }

            threat_res = calculate_threat_score(
                intrusion=in_zone,
                carried_object=has_carried,
                night_time=night,
                long_dwell=has_long_dwell,
                group_entry=in_group,
                person_id=track_id,
                vehicle_present=has_vehicle,
                plate_country=assoc_plate_country
            )
            threat_res["associated_vehicle_data"] = assoc_v_data
            self.person_threat_results[track_id] = threat_res

        # ========================================================
        # SECURITY EVENT GENERATION & BACKEND DISPATCH
        # ========================================================

        # 1. PERSON_ZONE_BREACH Event
        for track_id in current_inside_ids:
            if not self.event_manager.is_event_active("PERSON_ZONE_BREACH", track_id):
                self.event_manager.mark_event_active("PERSON_ZONE_BREACH", track_id)
                p_bbox = tracked_person_bboxes.get(track_id)
                t_info = self.person_threat_results.get(track_id, {})
                t_score = t_info.get("score", 30)
                v_data = t_info.get("associated_vehicle_data")
                evt = self.event_manager.create_event(
                    event_type="PERSON_ZONE_BREACH",
                    frame=frame,
                    person_data={"person_id": track_id, "person_bbox": p_bbox, "zone_status": "BREACH"},
                    vehicle_data=v_data,
                    zone_data={"zone_points": self.zone, "zone_status": "BREACH"},
                    threat_score=t_score
                )
                self.incident_recorder.trigger_clip(
                    event_id=evt["event_id"],
                    event_type=evt["event_type"],
                    actual_fps=30.0,
                    frame_size=(frame_width, frame_height)
                )

        for track_id in people_who_left:
            self.event_manager.clear_event_state("PERSON_ZONE_BREACH", track_id)

        # 2. CARRIED_OBJECT Event
        for track_id in carried_person_ids:
            if not self.event_manager.is_event_active("CARRIED_OBJECT", track_id):
                self.event_manager.mark_event_active("CARRIED_OBJECT", track_id)
                p_bbox = tracked_person_bboxes.get(track_id)
                t_info = self.person_threat_results.get(track_id, {})
                obj_info = self.person_object_motion_state.get(track_id, {})
                obj_name = obj_info.get("object_type", "backpack")
                t_score = t_info.get("score", 25)
                v_data = t_info.get("associated_vehicle_data")
                evt = self.event_manager.create_event(
                    event_type="CARRIED_OBJECT",
                    frame=frame,
                    person_data={"person_id": track_id, "person_bbox": p_bbox, "zone_status": "BREACH" if track_id in current_inside_ids else "OUTSIDE"},
                    vehicle_data=v_data,
                    object_data={"object_detected": True, "object_name": obj_name, "object_confidence": 0.85, "carried_object": True},
                    threat_score=t_score
                )
                self.incident_recorder.trigger_clip(
                    event_id=evt["event_id"],
                    event_type=evt["event_type"],
                    actual_fps=30.0,
                    frame_size=(frame_width, frame_height),
                    backend_event_id=None
                )

        for track_id in list(active_person_ids):
            if track_id not in carried_person_ids:
                self.event_manager.clear_event_state("CARRIED_OBJECT", track_id)

        # 3. GROUP_ENTRY Event
        if len(recent_entry_ids) >= 2:
            group_key = tuple(sorted(recent_entry_ids))
            if not self.event_manager.is_event_active("GROUP_ENTRY", group_key):
                self.event_manager.mark_event_active("GROUP_ENTRY", group_key)
                t_scores = [self.person_threat_results.get(pid, {}).get("score", 15) for pid in recent_entry_ids]
                max_group_threat = max(t_scores, default=15)
                first_pid = sorted(recent_entry_ids)[0]
                p_bbox = tracked_person_bboxes.get(first_pid)
                v_data = self.person_threat_results.get(first_pid, {}).get("associated_vehicle_data")
                evt = self.event_manager.create_event(
                    event_type="GROUP_ENTRY",
                    frame=frame,
                    person_data={"person_id": first_pid, "person_bbox": p_bbox, "zone_status": "BREACH"},
                    vehicle_data=v_data,
                    zone_data={"zone_points": self.zone, "zone_status": "BREACH"},
                    threat_score=max_group_threat
                )
                self.incident_recorder.trigger_clip(
                    event_id=evt["event_id"],
                    event_type=evt["event_type"],
                    actual_fps=30.0,
                    frame_size=(frame_width, frame_height),
                    backend_event_id=None
                )
        else:
            for event_tuple in list(self.event_manager.active_events):
                if event_tuple[0] == "GROUP_ENTRY":
                    self.event_manager.active_events.discard(event_tuple)

        # 4. DWELL_TIME Event
        for track_id in self.dwell_alerted_ids:
            if not self.event_manager.is_event_active("DWELL_TIME", track_id):
                self.event_manager.mark_event_active("DWELL_TIME", track_id)
                p_bbox = tracked_person_bboxes.get(track_id)
                t_info = self.person_threat_results.get(track_id, {})
                t_score = t_info.get("score", 15)
                v_data = t_info.get("associated_vehicle_data")
                evt = self.event_manager.create_event(
                    event_type="DWELL_TIME",
                    frame=frame,
                    person_data={"person_id": track_id, "person_bbox": p_bbox, "zone_status": "BREACH"},
                    vehicle_data=v_data,
                    zone_data={"zone_points": self.zone, "zone_status": "BREACH"},
                    threat_score=t_score
                )
                self.incident_recorder.trigger_clip(
                    event_id=evt["event_id"],
                    event_type=evt["event_type"],
                    actual_fps=30.0,
                    frame_size=(frame_width, frame_height),
                    backend_event_id=None
                )

        # 5. VEHICLE_DETECTED Event
        for v in confirmed_vehicles:
            v_id = v["id"]
            if not self.event_manager.is_event_active("VEHICLE_DETECTED", v_id):
                self.event_manager.mark_event_active("VEHICLE_DETECTED", v_id)
                p_state = self.vehicle_plate_states.get(v_id)
                stable_p_info = p_state.to_dict(vehicle_type=v["type"]) if p_state else {}
                v_country = stable_p_info.get("plate_country", "UNKNOWN")
                v_threat = 10 + (25 if v_country in ["NON_INDIA", "UNKNOWN"] else 0)
                evt = self.event_manager.create_event(
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
                self.incident_recorder.trigger_clip(
                    event_id=evt["event_id"],
                    event_type=evt["event_type"],
                    actual_fps=30.0,
                    frame_size=(frame_width, frame_height),
                    backend_event_id=None
                )
