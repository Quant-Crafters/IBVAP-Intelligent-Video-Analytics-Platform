import threading
import logging

try:
    from camera_worker import CameraWorker
except ImportError:
    from src.camera_worker import CameraWorker

logger = logging.getLogger("IBVAP.CameraManager")

class CameraManager:
    """
    Multi-camera runtime worker manager.
    Manages active CameraWorker instances by camera_id.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(CameraManager, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return

        with self._lock:
            if self._initialized:
                return

            self.workers = {}  # camera_id -> CameraWorker instance
            self._initialized = True
            print("🎥 CameraManager initialized.")

    def start_camera(self, camera_config: dict) -> dict:
        """
        Starts or registers a camera worker given camera_config.
        Validates camera_id and stream_url.
        """
        camera_id = camera_config.get("camera_id")
        if not camera_id:
            raise ValueError("Missing 'camera_id' in camera configuration")

        stream_url = camera_config.get("stream_url")
        if not stream_url:
            raise ValueError("Missing 'stream_url' in camera configuration")

        with self._lock:
            if camera_id in self.workers:
                worker = self.workers[camera_id]
                status = worker.get_status()
                if status["state"] in ("RUNNING", "STARTING", "RECONNECTING"):
                    print(f"[{camera_id}] Camera worker already active.")
                    return status
                else:
                    # Update config and restart worker
                    worker.update_config(camera_config)
                    worker.start()
                    return worker.get_status()

            # Create new worker
            worker = CameraWorker(camera_config)
            self.workers[camera_id] = worker
            worker.start()
            return worker.get_status()

    def stop_camera(self, camera_id: str) -> dict:
        """Stops an active camera worker by camera_id."""
        with self._lock:
            if camera_id not in self.workers:
                raise KeyError(f"Camera '{camera_id}' not found")
            worker = self.workers[camera_id]
            worker.stop()
            return worker.get_status()

    def restart_camera(self, camera_id: str) -> dict:
        """Restarts a camera worker by camera_id."""
        with self._lock:
            if camera_id not in self.workers:
                raise KeyError(f"Camera '{camera_id}' not found")
            worker = self.workers[camera_id]
            worker.restart()
            return worker.get_status()

    def update_camera_config(self, camera_id: str, new_config: dict) -> dict:
        """Updates configuration for camera_id (e.g. stream_url change)."""
        with self._lock:
            if camera_id not in self.workers:
                raise KeyError(f"Camera '{camera_id}' not found")
            worker = self.workers[camera_id]
            worker.update_config(new_config)
            return worker.get_status()

    def update_camera_zone(self, camera_id: str, zone_points: list) -> dict:
        """Updates zone polygon coordinates for camera_id."""
        with self._lock:
            if camera_id not in self.workers:
                raise KeyError(f"Camera '{camera_id}' not found")
            worker = self.workers[camera_id]
            worker.update_zone(zone_points)
            return worker.get_status()

    def get_camera_status(self, camera_id: str) -> dict:
        """Returns status for a specific camera worker."""
        with self._lock:
            if camera_id not in self.workers:
                raise KeyError(f"Camera '{camera_id}' not found")
            return self.workers[camera_id].get_status()

    def get_all_statuses(self) -> list:
        """Returns status list for all registered camera workers."""
        with self._lock:
            return [worker.get_status() for worker in self.workers.values()]


def get_camera_manager() -> CameraManager:
    return CameraManager()
