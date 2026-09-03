import cv2
import numpy as np

# ============================================================
# VEHICLE DETECTION & TEMPORAL STABILITY CONFIGURATION
# ============================================================

VEHICLE_CONFIDENCE = 0.35
VEHICLE_CONFIRM_FRAMES = 3
VEHICLE_IOU_THRESHOLD = 0.3
VEHICLE_MAX_MISSED_FRAMES = 10
BBOX_SMOOTH_ALPHA = 0.7  # Weighted moving average: 0.7 new + 0.3 prev

# COCO Vehicle Classes
VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}


def compute_iou(boxA, boxB):
    """
    Computes Intersection over Union (IoU) between two bounding boxes [x1, y1, x2, y2].
    """
    ax1, ay1, ax2, ay2 = boxA
    bx1, by1, bx2, by2 = boxB

    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)

    iw = max(0, ix2 - ix1)
    ih = max(0, iy2 - iy1)
    intersection = iw * ih

    areaA = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    areaB = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = areaA + areaB - intersection

    return intersection / float(union) if union > 0 else 0.0


def smooth_bbox(prev_bbox, new_bbox, alpha=BBOX_SMOOTH_ALPHA):
    """
    Applies exponential moving average smoothing to bounding box coordinates to eliminate jitter.
    """
    return [
        int(alpha * new_bbox[0] + (1 - alpha) * prev_bbox[0]),
        int(alpha * new_bbox[1] + (1 - alpha) * prev_bbox[1]),
        int(alpha * new_bbox[2] + (1 - alpha) * prev_bbox[2]),
        int(alpha * new_bbox[3] + (1 - alpha) * prev_bbox[3]),
    ]


class TrackedVehicle:
    def __init__(self, vehicle_id, vehicle_type, bbox, confidence):
        self.vehicle_id = vehicle_id
        self.type = vehicle_type
        self.raw_bbox = list(bbox)
        self.smoothed_bbox = list(bbox)
        self.confidence = confidence
        self.detection_count = 1
        self.missed_frames = 0
        self.confirmed = (self.detection_count >= VEHICLE_CONFIRM_FRAMES)

    def update(self, bbox, confidence, vehicle_type=None):
        if vehicle_type:
            self.type = vehicle_type
        self.raw_bbox = list(bbox)
        self.smoothed_bbox = smooth_bbox(self.smoothed_bbox, bbox)
        self.confidence = confidence
        self.detection_count += 1
        self.missed_frames = 0

        if self.detection_count >= VEHICLE_CONFIRM_FRAMES:
            self.confirmed = True

    def mark_missed(self):
        self.missed_frames += 1

    def is_expired(self):
        return self.missed_frames > VEHICLE_MAX_MISSED_FRAMES

    def to_dict(self):
        return {
            "id": self.vehicle_id,
            "type": self.type,
            "confidence": round(self.confidence, 2),
            "bbox": self.smoothed_bbox,
            "confirmed": self.confirmed,
            "detection_count": self.detection_count,
            "missed_frames": self.missed_frames
        }


class VehicleTrackerManager:
    def __init__(self, iou_threshold=VEHICLE_IOU_THRESHOLD):
        self.iou_threshold = iou_threshold
        self.tracked_vehicles = {}  # {vehicle_id: TrackedVehicle}
        self.next_vehicle_id = 1

    def update(self, current_detections: list) -> list:
        """
        Associates current detections with existing tracked vehicles using IoU.
        Returns list of active confirmed vehicle dicts.
        """
        matched_track_ids = set()
        matched_detection_indices = set()

        for det_idx, det in enumerate(current_detections):
            det_box = det["bbox"]
            best_iou = 0.0
            best_track_id = None

            for v_id, tracked_v in self.tracked_vehicles.items():
                if v_id in matched_track_ids:
                    continue

                iou = compute_iou(tracked_v.smoothed_bbox, det_box)
                if iou > best_iou and iou >= self.iou_threshold:
                    best_iou = iou
                    best_track_id = v_id

            if best_track_id is not None:
                self.tracked_vehicles[best_track_id].update(
                    det["bbox"],
                    det["confidence"],
                    det["type"]
                )
                matched_track_ids.add(best_track_id)
                matched_detection_indices.add(det_idx)

        for det_idx, det in enumerate(current_detections):
            if det_idx not in matched_detection_indices:
                v_id = self.next_vehicle_id
                self.next_vehicle_id += 1
                new_v = TrackedVehicle(v_id, det["type"], det["bbox"], det["confidence"])
                self.tracked_vehicles[v_id] = new_v

        for v_id, tracked_v in list(self.tracked_vehicles.items()):
            if v_id not in matched_track_ids:
                tracked_v.mark_missed()
                if tracked_v.is_expired():
                    del self.tracked_vehicles[v_id]

        confirmed_vehicles = [
            v.to_dict() for v in self.tracked_vehicles.values() if v.confirmed
        ]
        return confirmed_vehicles


def extract_vehicles_from_results(results, conf_threshold=VEHICLE_CONFIDENCE) -> list:
    """
    Extracts detected vehicles from Ultralytics YOLO results.
    """
    vehicles = []

    for result in results:
        for box in result.boxes:
            confidence = float(box.conf[0])
            class_id = int(box.cls[0])

            if confidence >= conf_threshold and class_id in VEHICLE_CLASSES:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                vehicle_type = VEHICLE_CLASSES[class_id]
                vehicles.append({
                    "type": vehicle_type,
                    "confidence": confidence,
                    "bbox": [x1, y1, x2, y2]
                })

    return vehicles


def detect_vehicles(frame, model, conf=VEHICLE_CONFIDENCE) -> list:
    """
    Runs YOLO model inference on a frame specifically for vehicle classes.
    """
    results = model(
        frame,
        conf=conf,
        classes=list(VEHICLE_CLASSES.keys()),
        verbose=False
    )
    return extract_vehicles_from_results(results, conf_threshold=conf)


def draw_vehicle_detections(frame, vehicles):
    """
    Draws bounding boxes and labels for confirmed vehicles on the frame.
    """
    for v in vehicles:
        x1, y1, x2, y2 = v["bbox"]
        v_type = v["type"].upper()
        v_id = v.get("id")
        conf_pct = int(v["confidence"] * 100)

        label = f"VEHICLE #{v_id} {v_type} {conf_pct}%" if v_id else f"{v_type} {conf_pct}%"

        # Bounding box in Amber / Cyan-Yellow (255, 191, 0)
        cv2.rectangle(
            frame,
            (x1, y1),
            (x2, y2),
            (255, 191, 0),
            2
        )

        # Text banner
        (text_width, text_height), _ = cv2.getTextSize(
            label,
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            2
        )
        cv2.rectangle(
            frame,
            (x1, max(y1 - 25, 0)),
            (x1 + text_width + 6, max(y1, 20)),
            (255, 191, 0),
            -1
        )

        cv2.putText(
            frame,
            label,
            (x1 + 3, max(y1 - 7, 16)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 0, 0),
            2
        )

    return frame


def find_associated_vehicle(person_bbox, confirmed_vehicles, min_score=0.25):
    """
    Computes scored spatial association between a person bounding box and active confirmed vehicles.
    Considers bounding box overlap ratio, feet-to-vehicle containment margin, and normalized center distance.
    Returns associated vehicle dictionary or None if no score meets min_score threshold.
    """
    if person_bbox is None or len(person_bbox) == 0 or not confirmed_vehicles:
        return None

    px1, py1, px2, py2 = person_bbox
    p_w = max(1, px2 - px1)
    p_h = max(1, py2 - py1)
    p_area = float(p_w * p_h)

    pcx = (px1 + px2) / 2.0
    pcy = (py1 + py2) / 2.0
    pfx = (px1 + px2) / 2.0
    pfy = float(py2)

    best_vehicle = None
    best_score = 0.0

    for v in confirmed_vehicles:
        vx1, vy1, vx2, vy2 = v["bbox"]
        vw = max(1, vx2 - vx1)
        vh = max(1, vy2 - vy1)
        v_diag = max(1.0, (vw ** 2 + vh ** 2) ** 0.5)

        # 1. Bounding Box Overlap / Intersection ratio relative to person area
        ix1 = max(px1, vx1)
        iy1 = max(py1, vy1)
        ix2 = min(px2, vx2)
        iy2 = min(py2, vy2)
        if ix2 > ix1 and iy2 > iy1:
            overlap_area = (ix2 - ix1) * (iy2 - iy1)
            overlap_ratio = min(1.0, overlap_area / p_area)
        else:
            overlap_ratio = 0.0

        # 2. Feet proximity (feet within vehicle bounding box or 30% vehicle margin)
        margin_x = 0.3 * vw
        margin_y = 0.3 * vh
        feet_in_margin = (
            (vx1 - margin_x) <= pfx <= (vx2 + margin_x) and
            (vy1 - margin_y) <= pfy <= (vy2 + margin_y)
        )
        feet_score = 1.0 if feet_in_margin else 0.0

        # 3. Normalized center-to-center distance score
        vcx = (vx1 + vx2) / 2.0
        vcy = (vy1 + vy2) / 2.0
        dist = ((pcx - vcx) ** 2 + (pcy - vcy) ** 2) ** 0.5
        dist_ratio = dist / v_diag
        dist_score = max(0.0, 1.0 - (dist_ratio / 1.5))

        # Composite Spatial Score
        composite_score = (0.45 * overlap_ratio) + (0.35 * feet_score) + (0.20 * dist_score)

        if composite_score > best_score:
            best_score = composite_score
            best_vehicle = v

    if best_score >= min_score:
        return best_vehicle

    return None

