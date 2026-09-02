import cv2

CAMERA_SOURCE = "http://100.76.64.41:8080/video"

cap = cv2.VideoCapture(CAMERA_SOURCE)

if not cap.isOpened():
    print("❌ Could not connect to phone camera")
    exit()

print("✅ Phone camera connected")

while True:

    ret, frame = cap.read()

    if not ret:
        print("❌ Failed to receive frame")
        break

    cv2.imshow("Phone Camera", frame)

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q") or key == 27:
        break

cap.release()
cv2.destroyAllWindows()