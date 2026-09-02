import sys
import os
import time
import requests
import json
import threading

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from src.config import settings
from src.event_dispatcher import get_event_dispatcher
from src.event_manager import EventManager
from src.camera_manager import get_camera_manager

def test_integration():
    print("=" * 60)
    print("🧪 RUNNING PRODUCTION INTEGRATION TESTS")
    print("=" * 60)

    # 1. Test Config Loading
    print("\n--- Test 1: Config & Environment Loading ---")
    assert settings.AI_SERVICE_PORT == 8001
    assert settings.AI_SERVICE_TOKEN is not None
    print("✅ Settings verified successfully.")

    # 2. Test Event Dispatcher & Event Manager Isolation
    print("\n--- Test 2: Event Manager & Dispatcher ---")
    em_cam1 = EventManager(camera_id="cam_test_001")
    em_cam2 = EventManager(camera_id="cam_test_002")

    # Generate test events
    evt1 = em_cam1.create_event(
        event_type="PERSON_ZONE_BREACH",
        frame=None,
        person_data={"person_id": 1, "person_bbox": [10, 10, 50, 50]},
        threat_score=75
    )
    assert evt1["camera_id"] == "cam_test_001"
    assert evt1["severity"] == "HIGH"
    assert evt1["evidence_image"] is None or "cam_test_001" in evt1["evidence_image"]
    print("✅ Camera ID cam_test_001 correctly populated in event payload.")

    evt2 = em_cam2.create_event(
        event_type="CARRIED_OBJECT",
        frame=None,
        person_data={"person_id": 2, "person_bbox": [20, 20, 60, 60]},
        object_data={"object_detected": True, "object_name": "backpack", "carried_object": True},
        threat_score=45
    )
    assert evt2["camera_id"] == "cam_test_002"
    assert evt2["severity"] == "MEDIUM"
    print("✅ Camera ID cam_test_002 correctly populated in event payload.")

    # 3. Test CameraManager & Workers
    print("\n--- Test 3: CameraManager Lifecycle & Reconfig ---")
    cm = get_camera_manager()

    cam_config_1 = {
        "camera_id": "cam_001",
        "name": "Gate Camera 1",
        "stream_url": "http://127.0.0.1:9999/dummy_stream",
        "camera_type": "ip_webcam",
        "enabled": True,
        "zone": [[100, 100], [400, 100], [400, 400], [100, 400]]
    }

    # Start camera worker
    status1 = cm.start_camera(cam_config_1)
    assert status1["camera_id"] == "cam_001"
    assert status1["has_zone"] == True
    print("✅ Camera cam_001 worker registered and started.")

    # Update camera stream URL (IP change simulation)
    new_config = {
        "stream_url": "http://127.0.0.1:8888/new_video_stream"
    }
    updated_status = cm.update_camera_config("cam_001", new_config)
    assert updated_status["stream_url"] == "http://127.0.0.1:8888/new_video_stream"
    assert updated_status["camera_id"] == "cam_001"
    print("✅ Camera stream URL updated dynamically while preserving camera_id cam_001!")

    # Update zone
    new_zone = [[50, 50], [200, 50], [200, 200], [50, 200]]
    updated_zone_status = cm.update_camera_zone("cam_001", new_zone)
    assert updated_zone_status["zone_points_count"] == 4
    print("✅ Camera zone updated dynamically!")

    # Stop camera worker
    stopped_status = cm.stop_camera("cam_001")
    assert stopped_status["state"] == "STOPPED"
    print("✅ Camera worker stopped cleanly.")

    print("\n=" * 60)
    print("🎉 ALL INTEGRATION TESTS PASSED CLEANLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_integration()
