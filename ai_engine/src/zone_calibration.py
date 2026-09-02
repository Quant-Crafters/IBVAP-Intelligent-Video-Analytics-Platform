import cv2
import json
import os
import sys
import argparse
import numpy as np

try:
    from config import settings
except ImportError:
    from src.config import settings

# ============================================================
# CLI ARGUMENT PARSER & CONFIGURATION
# ============================================================

def parse_args():
    parser = argparse.ArgumentParser(description="IBVAP AI Engine - Interactive Zone Calibration Utility")
    parser.add_argument(
        "--stream-url",
        type=str,
        default=os.getenv("STREAM_URL", "0"),
        help="Camera stream URL (RTSP / HTTP IP Webcam URL) or integer camera index (e.g. 0)"
    )
    parser.add_argument(
        "--camera-id",
        type=str,
        default="cam_001",
        help="Camera ID for saving calibration zone configuration"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to output zone JSON file (default: config/zone.json)"
    )
    return parser.parse_args()


args = parse_args()

# Parse integer source if numeric (e.g., '0' -> 0)
stream_source = args.stream_url
if stream_source.isdigit():
    stream_source = int(stream_source)

print("=" * 60)
print("ZONE CALIBRATION UTILITY")
print(f"Camera ID   : {args.camera_id}")
print(f"Stream URL  : {stream_source}")
print("=" * 60)

cap = cv2.VideoCapture(stream_source)

if not cap.isOpened():
    print(f"❌ Error: Could not open camera stream: {stream_source}")
    sys.exit(1)


# ============================================================
# STATE
# ============================================================

points = []


def mouse_callback(event, x, y, flags, param):
    global points

    if event == cv2.EVENT_LBUTTONDOWN:
        points.append((x, y))
    elif event == cv2.EVENT_RBUTTONDOWN:
        if points:
            points.pop()


def save_zone(points, camera_id=args.camera_id, output_path=args.output):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)

    if output_path is None:
        config_dir = os.path.join(base_dir, "config")
        os.makedirs(config_dir, exist_ok=True)
        config_path = os.path.join(config_dir, "zone.json")
    else:
        config_path = output_path
        os.makedirs(os.path.dirname(os.path.abspath(config_path)), exist_ok=True)

    data = {
        "camera_id": camera_id,
        "zone": [[int(pt[0]), int(pt[1])] for pt in points]
    }

    with open(config_path, "w") as f:
        json.dump(data, f, indent=4)

    print()
    print("=" * 60)
    print("ZONE SAVED SUCCESSFULLY")
    print(f"Camera ID : {camera_id}")
    print(f"File Path : {config_path}")
    print(f"Total Pts : {len(points)}")
    print("Coordinates:")
    for i, pt in enumerate(points, 1):
        print(f"  Point {i}: ({pt[0]}, {pt[1]})")
    print("=" * 60)
    print()


# ============================================================
# MAIN CALIBRATION LOOP
# ============================================================

window_name = f"IBVAP Zone Calibration - [{args.camera_id}]"
cv2.namedWindow(window_name)
cv2.setMouseCallback(window_name, mouse_callback)

print("Starting Zone Calibration Tool...")
print("Instructions:")
print("  - LEFT CLICK  : Add polygon point")
print("  - RIGHT CLICK : Remove last point")
print("  - 'R'         : Reset all points")
print("  - 'ENTER'     : Confirm & Save Zone (min 3 points)")
print("  - 'Q' or ESC  : Quit without saving")

while True:
    ret, frame = cap.read()

    if not ret:
        print("Could not read frame from camera")
        break

    display_frame = frame.copy()

    for pt in points:
        cv2.circle(display_frame, pt, 5, (0, 0, 255), -1)

    if len(points) >= 2:
        pts_array = np.array(points, np.int32)
        is_closed = len(points) >= 3
        cv2.polylines(
            display_frame,
            [pts_array],
            isClosed=is_closed,
            color=(255, 255, 0),
            thickness=2
        )

        if is_closed:
            overlay = display_frame.copy()
            cv2.fillPoly(overlay, [pts_array], (255, 255, 0))
            cv2.addWeighted(overlay, 0.25, display_frame, 0.75, 0, display_frame)

    instructions = [
        "LEFT CLICK: Add point | RIGHT CLICK: Remove",
        "R: Reset | ENTER: Save | Q/ESC: Quit",
    ]

    y_offset = 30
    for text in instructions:
        cv2.putText(
            display_frame,
            text,
            (20, y_offset),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.60,
            (0, 255, 255),
            2
        )
        y_offset += 25

    status_color = (0, 255, 0) if len(points) >= 3 else (0, 0, 255)
    status_text = f"POINTS: {len(points)}" + (" (Ready to save)" if len(points) >= 3 else " (Min 3 needed)")

    cv2.putText(
        display_frame,
        status_text,
        (20, y_offset + 5),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        status_color,
        2
    )

    cv2.imshow(window_name, display_frame)

    key = cv2.waitKey(1) & 0xFF

    if key in (ord('r'), ord('R')):
        points.clear()
        print("Points reset.")
    elif key in (13, 10):  # ENTER
        if len(points) >= 3:
            save_zone(points)
            break
        else:
            print("⚠️ Cannot save zone. Minimum 3 points required.")
    elif key in (ord('q'), ord('Q'), 27):  # Q or ESC
        print("Calibration cancelled without saving.")
        break

cap.release()
cv2.destroyAllWindows()
