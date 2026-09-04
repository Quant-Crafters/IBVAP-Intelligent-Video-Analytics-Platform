import cv2
import json
import os
import sys
import numpy as np
import uuid
from datetime import datetime
from pathlib import Path

try:
    from config import settings
    from event_dispatcher import get_event_dispatcher
except ImportError:
    from src.config import settings
    from src.event_dispatcher import get_event_dispatcher


class EventManager:
    """
    Modular Event & Evidence Manager for the IBVAP AI Engine.
    Handles structured event creation, state deduplication, evidence image
    annotation, per-camera isolated directory storage, and non-blocking
    HTTP dispatch to the Go backend.
    """

    def __init__(
        self,
        camera_id: str = "default_camera",
        base_dir=None,
        incident_recorder=None
    ):
        self.camera_id = camera_id

        if base_dir is None:
            self.base_dir = settings.BASE_DIR
        else:
            self.base_dir = base_dir

        self.incident_recorder = incident_recorder

        self.evidence_dir = os.path.join(
            self.base_dir,
            settings.EVIDENCE_DIRECTORY,
            "evidence",
            self.camera_id
        )

        self.json_dir = os.path.join(
            self.base_dir,
            settings.EVIDENCE_DIRECTORY,
            "json",
            self.camera_id
        )

        os.makedirs(self.evidence_dir, exist_ok=True)
        os.makedirs(self.json_dir, exist_ok=True)

        self.active_events = set()
        self.dispatcher = get_event_dispatcher()
        from concurrent.futures import ThreadPoolExecutor
        self._write_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix=f"EvidenceWrite-{self.camera_id}")

    def is_event_active(self, event_type: str, entity_id) -> bool:
        return (event_type, entity_id) in self.active_events

    def mark_event_active(self, event_type: str, entity_id):
        if entity_id is not None:
            self.active_events.add((event_type, entity_id))

    def clear_event_state(self, event_type: str, entity_id):
        if entity_id is not None:
            self.active_events.discard((event_type, entity_id))

    def create_event(
        self,
        event_type: str,
        frame,
        person_data=None,
        vehicle_data=None,
        object_data=None,
        zone_data=None,
        threat_score=0
    ) -> dict:

        event_id = str(uuid.uuid4())
        timestamp_str = datetime.now().astimezone().isoformat()

        t_int = int(threat_score)

        if t_int < 30:
            severity = "LOW"
        elif t_int < 60:
            severity = "MEDIUM"
        else:
            severity = "HIGH"

        event_record = {
            "event_id": event_id,
            "camera_id": self.camera_id,
            "timestamp": timestamp_str,
            "event_type": event_type,
            "severity": severity,
            "threat_score": t_int,
            "person_id": person_data.get("person_id") if person_data else None,
            "vehicle_id": vehicle_data.get("vehicle_id") if vehicle_data else None,
            "detection_data": {
                "person_bbox": person_data.get("person_bbox") if person_data else None,
                "vehicle_bbox": vehicle_data.get("vehicle_bbox") if vehicle_data else None,
                "zone_status": (
                    zone_data.get("zone_status")
                    if zone_data
                    else (
                        person_data.get("zone_status")
                        if person_data
                        else None
                    )
                ),
                "object_detected": (
                    bool(object_data.get("object_detected", False))
                    if object_data else False
                ),
                "object_name": (
                    object_data.get("object_name")
                    if object_data else None
                ),
                "object_confidence": (
                    float(object_data.get("object_confidence", 0.0))
                    if object_data else 0.0
                ),
                "carried_object": (
                    bool(object_data.get("carried_object", False))
                    if object_data else False
                ),
                "vehicle_present": bool(vehicle_data is not None),
                "vehicle_type": (
                    vehicle_data.get("vehicle_type")
                    if vehicle_data else None
                ),
                "plate_number": (
                    vehicle_data.get("plate_number")
                    if vehicle_data else None
                ),
                "plate_country": (
                    vehicle_data.get("plate_country")
                    if vehicle_data else None
                ),
                "plate_confidence": (
                    float(vehicle_data.get("plate_confidence", 0.0))
                    if vehicle_data else 0.0
                ),
            },
            "evidence_image": None,
            "incident_clip": None
        }

        # ============================================================
        # 1. ANNOTATE & SAVE EVIDENCE IMAGE
        # ============================================================

        evidence_rel_path = None

        if frame is not None and frame.size > 0:
            try:
                annotated = frame.copy()

                # Restricted zone
                if zone_data and zone_data.get("zone_points") is not None:
                    pts = np.array(
                        zone_data["zone_points"],
                        np.int32
                    )
                    cv2.polylines(
                        annotated,
                        [pts],
                        True,
                        (255, 255, 0),
                        2
                    )

                # Person bounding box
                if person_data and person_data.get("person_bbox"):
                    px1, py1, px2, py2 = person_data["person_bbox"]
                    pid = person_data.get("person_id")

                    cv2.rectangle(
                        annotated,
                        (px1, py1),
                        (px2, py2),
                        (0, 0, 255),
                        2
                    )

                    p_label = (
                        f"PERSON #{pid}"
                        if pid else "PERSON"
                    )

                    cv2.putText(
                        annotated,
                        p_label,
                        (px1, max(py1 - 8, 15)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (0, 0, 255),
                        2
                    )

                # Vehicle bounding box
                if vehicle_data and vehicle_data.get("vehicle_bbox"):
                    vx1, vy1, vx2, vy2 = vehicle_data["vehicle_bbox"]
                    vid = vehicle_data.get("vehicle_id")
                    vtype = vehicle_data.get(
                        "vehicle_type",
                        "VEHICLE"
                    )

                    cv2.rectangle(
                        annotated,
                        (vx1, vy1),
                        (vx2, vy2),
                        (255, 191, 0),
                        2
                    )

                    v_label = (
                        f"VEHICLE #{vid}: {vtype.upper()}"
                        if vid else vtype.upper()
                    )

                    cv2.putText(
                        annotated,
                        v_label,
                        (vx1, max(vy1 - 8, 15)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (255, 191, 0),
                        2
                    )

                    if vehicle_data.get("plate_bbox"):
                        px1, py1, px2, py2 = vehicle_data["plate_bbox"]
                        p_country = vehicle_data.get(
                            "plate_country",
                            "UNKNOWN"
                        )
                        p_num = vehicle_data.get(
                            "plate_number",
                            "UNKNOWN"
                        )

                        p_color = (
                            (0, 255, 0)
                            if p_country == "INDIA"
                            else (
                                (0, 255, 255)
                                if p_country == "NON_INDIA"
                                else (0, 165, 255)
                            )
                        )

                        cv2.rectangle(
                            annotated,
                            (px1, py1),
                            (px2, py2),
                            p_color,
                            2
                        )

                        cv2.putText(
                            annotated,
                            f"PLATE: {p_num}",
                            (px1, max(py1 - 6, 15)),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.5,
                            p_color,
                            2
                        )

                # Object label
                if object_data and object_data.get("object_name"):
                    obj_name = object_data["object_name"]

                    cv2.putText(
                        annotated,
                        f"OBJECT: {obj_name.upper()}",
                        (20, 140),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 165, 255),
                        2
                    )

                # Top banner
                cv2.rectangle(
                    annotated,
                    (0, 0),
                    (annotated.shape[1], 40),
                    (0, 0, 0),
                    -1
                )

                banner_text = (
                    f"CAM: {self.camera_id} | "
                    f"EVENT: {event_type} | "
                    f"THREAT SCORE: {t_int}"
                )

                cv2.putText(
                    annotated,
                    banner_text,
                    (15, 26),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.75,
                    (0, 255, 255),
                    2
                )

                filename = f"{event_id}.jpg"

                abs_filepath = os.path.join(
                    self.evidence_dir,
                    filename
                )

                rel_filepath = os.path.join(
                    settings.EVIDENCE_DIRECTORY,
                    "evidence",
                    self.camera_id,
                    filename
                ).replace("\\", "/")

                evidence_rel_path = rel_filepath

                # Async writing of image & json metadata
                json_filename = f"{event_id}.json"
                abs_json_path = os.path.join(self.json_dir, json_filename)
                
                def _async_save_files(img_path, img_data, json_path, record_data, cid):
                    try:
                        cv2.imwrite(img_path, img_data)
                        with open(json_path, "w") as f:
                            json.dump(record_data, f, indent=4)
                        print(f"[{cid}] EVIDENCE & METADATA SAVED: {os.path.abspath(img_path)}")
                    except Exception as err:
                        print(f"[{cid}] ASYNC EVIDENCE SAVE ERROR: {err}")

                self._write_executor.submit(
                    _async_save_files,
                    abs_filepath,
                    annotated,
                    abs_json_path,
                    event_record,
                    self.camera_id
                )

            except Exception as e:
                print(
                    f"[{self.camera_id}] EVIDENCE SAVE ERROR: {e}"
                )

        event_record["evidence_image"] = evidence_rel_path

        # ============================================================
        # 3. TERMINAL EVENT LOG
        # ============================================================

        pid_display = (
            event_record["person_id"]
            if event_record["person_id"] is not None
            else "N/A"
        )

        vid_display = (
            event_record["vehicle_id"]
            if event_record["vehicle_id"] is not None
            else "N/A"
        )

        det_data = event_record["detection_data"]

        obj_display = (
            det_data["object_name"]
            if det_data["object_name"] is not None
            else "N/A"
        )

        carried_display = (
            "YES"
            if det_data["carried_object"]
            else "NO"
        )

        plate_display = (
            det_data["plate_number"]
            if det_data["plate_number"] is not None
            else "N/A"
        )

        country_display = (
            det_data["plate_country"]
            if det_data["plate_country"] is not None
            else "N/A"
        )

        print("========================================")
        print(f"SECURITY EVENT [{self.camera_id}]")
        print("========================================")
        print(f"EVENT ID        : {event_id}")
        print(f"CAMERA ID       : {self.camera_id}")
        print(f"EVENT TYPE      : {event_type}")
        print(f"TIMESTAMP       : {timestamp_str}")
        print(f"PERSON ID       : {pid_display}")
        print(f"VEHICLE ID      : {vid_display}")
        print(f"OBJECT          : {obj_display}")
        print(f"CARRIED         : {carried_display}")
        print(f"PLATE           : {plate_display}")
        print(f"COUNTRY         : {country_display}")
        print(f"THREAT SCORE    : {threat_score}")
        print(
            f"EVIDENCE        : "
            f"{evidence_rel_path if evidence_rel_path else 'NONE'}"
        )
        print("========================================")

        # ============================================================
        # 4. DISPATCH EVENT TO GO BACKEND
        # ============================================================

        try:
            self.dispatcher.dispatch(
                event_record,
                incident_recorder=self.incident_recorder
            )
        except Exception as e:
            print(
                f"[{self.camera_id}] "
                f"EVENT DISPATCH ENQUEUE ERROR: {e}"
            )

        return event_record