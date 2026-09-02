import os
import threading
from pathlib import Path
from ultralytics import YOLO
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

try:
    from config import settings
except ImportError:
    from src.config import settings

class ModelLoader:
    """
    Singleton thread-safe loader for AI detection models.
    Loads YOLOv11 and MediaPipe Hand Landmarker once into memory.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ModelLoader, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return

        with self._lock:
            if self._initialized:
                return

            self.base_dir = settings.BASE_DIR
            self.yolo_model_path = self._find_yolo_model()
            self.hand_model_path = self._find_hand_model()

            # Initialize YOLO
            print(f"🤖 Loading YOLO model from {self.yolo_model_path}...")
            self.yolo_model = YOLO(self.yolo_model_path)

            # Initialize MediaPipe Hand Detector
            self.hand_detector = None
            if self.hand_model_path and os.path.exists(self.hand_model_path):
                print(f"🖐️ Loading MediaPipe Hand Landmarker from {self.hand_model_path}...")
                try:
                    base_options = python.BaseOptions(model_asset_path=self.hand_model_path)
                    hand_options = vision.HandLandmarkerOptions(
                        base_options=base_options,
                        num_hands=4,
                        min_hand_detection_confidence=0.5,
                        min_hand_presence_confidence=0.5,
                        min_tracking_confidence=0.5
                    )
                    self.hand_detector = vision.HandLandmarker.create_from_options(hand_options)
                except Exception as e:
                    print(f"⚠️ Warning: Failed to load MediaPipe Hand Landmarker: {e}")
            else:
                print("⚠️ MediaPipe Hand Landmarker model file not found. Hand tracking will be bypassed.")

            self._inference_lock = threading.Lock()
            self._initialized = True

    def _find_yolo_model(self) -> str:
        candidates = [
            os.path.join(self.base_dir, "yolo11n.pt"),
            os.path.join(self.base_dir, "ai_engine", "yolo11n.pt"),
            "yolo11n.pt"
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return "yolo11n.pt"

    def _find_hand_model(self) -> str:
        candidates = [
            os.path.join(self.base_dir, "models", "hand_landmarker.task"),
            os.path.join(self.base_dir, "ai_engine", "models", "hand_landmarker.task"),
            os.path.join("models", "hand_landmarker.task")
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return None

    def run_yolo_tracking(self, frame, tracker="bytetrack.yaml", conf=0.20, iou=0.50, imgsz=960):
        """Thread-safe YOLO tracking inference execution."""
        with self._inference_lock:
            return self.yolo_model.track(
                frame,
                persist=True,
                tracker=tracker,
                conf=conf,
                iou=iou,
                imgsz=imgsz,
                verbose=False
            )

    def detect_hands(self, mp_image):
        """Thread-safe MediaPipe hand landmark detection."""
        if self.hand_detector is None:
            return None
        with self._inference_lock:
            try:
                return self.hand_detector.detect(mp_image)
            except Exception as e:
                return None


def get_model_loader() -> ModelLoader:
    return ModelLoader()
