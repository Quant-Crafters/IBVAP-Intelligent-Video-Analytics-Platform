import cv2
import mediapipe as mp

from ultralytics import YOLO
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


# ============================================================
# CONFIG
# ============================================================

YOLO_MODEL = "yolo11n.pt"
HAND_MODEL = "models/hand_landmarker.task"

CONFIDENCE_THRESHOLD = 0.60

# Restricted zone
ZONE_X1 = 150
ZONE_Y1 = 100
ZONE_X2 = 550
ZONE_Y2 = 450


# ============================================================
# YOLO
# ============================================================

model = YOLO(YOLO_MODEL)


# ============================================================
# MEDIAPIPE HAND LANDMARKER
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

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise RuntimeError("Could not open camera")


# ============================================================
# MAIN LOOP
# ============================================================

while True:

    ret, frame = cap.read()

    if not ret:
        print("Could not read frame")
        break

    frame_height, frame_width, _ = frame.shape


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

        # Wrist landmark = 0
        wrist = hand_landmarks[0]

        hand_x = int(wrist.x * frame_width)
        hand_y = int(wrist.y * frame_height)

        hand_centers.append(
            (hand_x, hand_y, hand_landmarks)
        )


    # ========================================================
    # DRAW HANDS
    # ========================================================

    for hand_x, hand_y, hand_landmarks in hand_centers:

        # Draw landmarks
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

        # Highlight wrist
        cv2.circle(
            frame,
            (hand_x, hand_y),
            7,
            (0, 0, 255),
            -1
        )


    # ========================================================
    # PERSON DETECTION + TRACKING
    # ========================================================

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


            # ==================================================
            # PERSON CENTER
            # ==================================================

            person_center_x = int(
                (x1 + x2) / 2
            )

            person_center_y = int(
                (y1 + y2) / 2
            )


            # ==================================================
            # ZONE CHECK
            # ==================================================

            inside_zone = (
                ZONE_X1 <= person_center_x <= ZONE_X2
                and
                ZONE_Y1 <= person_center_y <= ZONE_Y2
            )


            # ==================================================
            # FIND NEAREST HAND
            # ==================================================

            nearest_hand = None
            nearest_distance = float("inf")

            for hand_x, hand_y, _ in hand_centers:

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


            # ==================================================
            # HAND ASSOCIATION
            # ==================================================

            hand_detected = False

            # Require hand to be reasonably close
            # to the person's bounding box.

            if nearest_hand is not None:

                hand_x, hand_y = nearest_hand

                margin = 100

                hand_detected = (
                    x1 - margin <= hand_x <= x2 + margin
                    and
                    y1 - margin <= hand_y <= y2 + margin
                )


            # ==================================================
            # DRAW PERSON
            # ==================================================

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 0, 255),
                2
            )


            # ==================================================
            # PERSON CENTER
            # ==================================================

            cv2.circle(
                frame,
                (
                    person_center_x,
                    person_center_y
                ),
                5,
                (0, 0, 255),
                -1
            )


            # ==================================================
            # LABEL
            # ==================================================

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


            # ==================================================
            # HAND STATUS
            # ==================================================

            if hand_detected:

                hand_label = "HAND: DETECTED"

                cv2.putText(
                    frame,
                    hand_label,
                    (x1, y2 + 25),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (0, 0, 255),
                    2
                )

                # Draw association line
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


            # ==================================================
            # ZONE STATUS
            # ==================================================

            if inside_zone:

                cv2.putText(
                    frame,
                    "BREACH",
                    (x1, y2 + 50),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.60,
                    (0, 0, 255),
                    2
                )


    # ========================================================
    # RESTRICTED ZONE
    # ========================================================

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


    # ========================================================
    # GLOBAL INFO
    # ========================================================

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
        f"HANDS: {len(hand_centers)}",
        (20, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 0, 255),
        2
    )


    # ========================================================
    # DISPLAY
    # ========================================================

    cv2.imshow(
        "IBVAP - Person + Hand Tracking",
        frame
    )


    # ========================================================
    # EXIT
    # ========================================================

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q") or key == 27:
        break


cap.release()
hand_detector.close()
cv2.destroyAllWindows()