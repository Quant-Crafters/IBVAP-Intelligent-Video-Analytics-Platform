import cv2
from ultralytics import YOLO


model = YOLO("yolo11s.pt")

# COCO classes
TARGET_CLASSES = {
    43: "knife",
    76: "scissors"
}

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise RuntimeError("Could not open camera")


while True:

    ret, frame = cap.read()

    if not ret:
        break

    results = model(
    frame,
    conf=0.15,
    imgsz=1280,
    verbose=False
)

    detected = 0

    for result in results:

        for box in result.boxes:

            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            if class_id not in TARGET_CLASSES:
                continue

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )

            object_name = TARGET_CLASSES[class_id]

            detected += 1

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 0, 255),
                3
            )

            cv2.putText(
                frame,
                f"{object_name} {confidence:.2f}",
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2
            )

            print(
                f"OBJECT: {object_name} | "
                f"CONFIDENCE: {confidence:.2f}"
            )


    cv2.putText(
        frame,
        f"TARGET OBJECTS: {detected}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (0, 0, 255),
        2
    )

    cv2.imshow(
        "IBVAP - Object Detection Test",
        frame
    )

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q") or key == 27:
        break


cap.release()
cv2.destroyAllWindows()