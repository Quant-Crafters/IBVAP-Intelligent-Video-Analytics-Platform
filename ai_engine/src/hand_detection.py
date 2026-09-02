import cv2
import mediapipe as mp

from mediapipe.tasks import python
from mediapipe.tasks.python import vision


# ==========================================
# HAND LANDMARK MODEL
# ==========================================

MODEL_PATH = "models/hand_landmarker.task"

base_options = python.BaseOptions(
    model_asset_path=MODEL_PATH
)

options = vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=4,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5
)

detector = vision.HandLandmarker.create_from_options(options)


# ==========================================
# CAMERA
# ==========================================

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise RuntimeError("Could not open camera")


# ==========================================
# MAIN LOOP
# ==========================================

while True:

    ret, frame = cap.read()

    if not ret:
        print("Could not read frame")
        break

    # OpenCV BGR -> RGB
    rgb_frame = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    # MediaPipe image
    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb_frame
    )

    # Detect hands
    result = detector.detect(mp_image)

    hand_count = len(result.hand_landmarks)

    # ======================================
    # DRAW HAND LANDMARKS
    # ======================================

    for hand_landmarks in result.hand_landmarks:

        h, w, _ = frame.shape

        # Draw landmark points
        for landmark in hand_landmarks:

            x = int(landmark.x * w)
            y = int(landmark.y * h)

            cv2.circle(
                frame,
                (x, y),
                4,
                (0, 0, 255),
                -1
            )

        # Draw connections
        connections = [
            (0, 1), (1, 2), (2, 3), (3, 4),
            (0, 5), (5, 6), (6, 7), (7, 8),
            (0, 9), (9, 10), (10, 11), (11, 12),
            (0, 13), (13, 14), (14, 15), (15, 16),
            (0, 17), (17, 18), (18, 19), (19, 20)
        ]

        for start, end in connections:

            x1 = int(hand_landmarks[start].x * w)
            y1 = int(hand_landmarks[start].y * h)

            x2 = int(hand_landmarks[end].x * w)
            y2 = int(hand_landmarks[end].y * h)

            cv2.line(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 0, 255),
                2
            )


    # ======================================
    # DISPLAY COUNT
    # ======================================

    cv2.putText(
        frame,
        f"HANDS: {hand_count}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 0, 255),
        2
    )


    # ======================================
    # DISPLAY
    # ======================================

    cv2.imshow(
        "IBVAP - Hand Detection",
        frame
    )


    # ======================================
    # EXIT
    # ======================================

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q") or key == 27:
        break


cap.release()
detector.close()
cv2.destroyAllWindows()