import sys
import os
import time

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from src.vehicle_detection import find_associated_vehicle
from src.threat_engine import calculate_threat_score
from src.event_manager import EventManager
from src.camera_worker import CameraWorker

def run_entity_association_tests():
    print("=" * 60)
    print("🧪 RUNNING ENTITY ASSOCIATION REGRESSION TESTS (A-H)")
    print("=" * 60)

    # -------------------------------------------------------------
    # Test A: Person with no vehicle
    # -------------------------------------------------------------
    print("\n--- Test A: Person with no vehicle ---")
    p_bbox_a = [10, 10, 50, 120]
    confirmed_vehicles_empty = []
    assoc_a = find_associated_vehicle(p_bbox_a, confirmed_vehicles_empty)
    assert assoc_a is None, "Expected no vehicle association when no vehicles exist"

    threat_a = calculate_threat_score(
        intrusion=True,
        person_id=1,
        vehicle_present=(assoc_a is not None),
        plate_country=None
    )
    assert threat_a["score"] == 30, f"Expected threat score 30 (intrusion only), got {threat_a['score']}"
    assert "Vehicle present" not in threat_a["factors"]
    print("✅ Test A Passed: Person with no vehicle receives 0 vehicle/plate risk.")

    # -------------------------------------------------------------
    # Test B: Vehicle elsewhere in frame
    # -------------------------------------------------------------
    print("\n--- Test B: Vehicle elsewhere in frame ---")
    p_bbox_b = [10, 10, 50, 120]
    v_bbox_far = [800, 800, 1100, 950]
    confirmed_vehicles_far = [{"id": 1, "type": "car", "bbox": v_bbox_far, "confidence": 0.9}]

    assoc_b = find_associated_vehicle(p_bbox_b, confirmed_vehicles_far)
    assert assoc_b is None, "Expected no vehicle association for person far away from vehicle"

    threat_b = calculate_threat_score(
        intrusion=True,
        person_id=1,
        vehicle_present=(assoc_b is not None),
        plate_country=None
    )
    assert threat_b["score"] == 30
    assert "Vehicle present" not in threat_b["factors"]
    print("✅ Test B Passed: Person far from vehicle receives no vehicle/plate risk.")

    # -------------------------------------------------------------
    # Test C: Person genuinely associated with vehicle
    # -------------------------------------------------------------
    print("\n--- Test C: Person associated with vehicle ---")
    p_bbox_c = [100, 100, 160, 250]
    v_bbox_near = [90, 90, 300, 300]
    confirmed_vehicles_near = [{"id": 10, "type": "truck", "bbox": v_bbox_near, "confidence": 0.95}]

    assoc_c = find_associated_vehicle(p_bbox_c, confirmed_vehicles_near)
    assert assoc_c is not None and assoc_c["id"] == 10

    threat_c = calculate_threat_score(
        intrusion=True,
        person_id=1,
        vehicle_present=(assoc_c is not None),
        plate_country="NON_INDIA"
    )
    # Intrusion (+30) + Vehicle present (+10) + Non-Indian vehicle (+25) = 65
    assert threat_c["score"] == 65
    assert "Vehicle present" in threat_c["factors"]
    assert "Non-Indian vehicle" in threat_c["factors"]
    print("✅ Test C Passed: Associated person receives correct vehicle & plate threat contribution.")

    # -------------------------------------------------------------
    # Test D: Two people, one vehicle
    # -------------------------------------------------------------
    print("\n--- Test D: Two people, one vehicle ---")
    p_bbox_near = [100, 100, 160, 250]
    p_bbox_far = [600, 600, 650, 750]
    v_single = [{"id": 5, "type": "car", "bbox": [90, 90, 300, 300], "confidence": 0.9}]

    assoc_near = find_associated_vehicle(p_bbox_near, v_single)
    assoc_far = find_associated_vehicle(p_bbox_far, v_single)

    assert assoc_near is not None and assoc_near["id"] == 5
    assert assoc_far is None
    print("✅ Test D Passed: Only the nearby person is associated with the vehicle.")

    # -------------------------------------------------------------
    # Test E: Two vehicles
    # -------------------------------------------------------------
    print("\n--- Test E: Two vehicles ---")
    v_multi = [
        {"id": 1, "type": "car", "bbox": [50, 50, 200, 200], "confidence": 0.9},
        {"id": 2, "type": "truck", "bbox": [500, 500, 800, 800], "confidence": 0.9}
    ]
    p_near_v1 = [60, 60, 120, 180]
    p_near_v2 = [520, 520, 580, 680]

    assoc_p1 = find_associated_vehicle(p_near_v1, v_multi)
    assoc_p2 = find_associated_vehicle(p_near_v2, v_multi)

    assert assoc_p1 is not None and assoc_p1["id"] == 1
    assert assoc_p2 is not None and assoc_p2["id"] == 2
    print("✅ Test E Passed: Correct person -> vehicle mapping maintained for multiple vehicles.")

    # -------------------------------------------------------------
    # Test F: Zone breach without vehicle
    # -------------------------------------------------------------
    print("\n--- Test F: Zone breach without vehicle ---")
    p_bbox_z = [150, 150, 200, 300]
    threat_f = calculate_threat_score(
        intrusion=True,
        person_id=1,
        vehicle_present=False,
        plate_country=None
    )
    assert threat_f["score"] == 30
    assert threat_f["level"] == "MEDIUM"
    print("✅ Test F Passed: Zone breach threat works cleanly without vehicle risk.")

    # -------------------------------------------------------------
    # Test G: Event payload schema
    # -------------------------------------------------------------
    print("\n--- Test G: Event payload schema ---")
    em = EventManager(camera_id="cam_test_assoc")

    # Person with NO vehicle
    evt_no_v = em.create_event(
        event_type="PERSON_ZONE_BREACH",
        frame=None,
        person_data={"person_id": 101, "person_bbox": [10, 10, 50, 120]},
        vehicle_data=None,
        threat_score=30
    )
    assert evt_no_v["person_id"] == 101
    assert evt_no_v["vehicle_id"] is None
    assert evt_no_v["detection_data"]["vehicle_present"] == False
    assert evt_no_v["detection_data"]["plate_number"] is None

    # Person WITH vehicle
    v_data_assoc = {
        "vehicle_id": 42,
        "vehicle_type": "car",
        "vehicle_bbox": [100, 100, 300, 300],
        "plate_number": "KA01AB1234",
        "plate_country": "INDIA",
        "plate_confidence": 0.92
    }
    evt_with_v = em.create_event(
        event_type="PERSON_ZONE_BREACH",
        frame=None,
        person_data={"person_id": 102, "person_bbox": [110, 110, 160, 240]},
        vehicle_data=v_data_assoc,
        threat_score=40
    )
    assert evt_with_v["person_id"] == 102
    assert evt_with_v["vehicle_id"] == 42
    assert evt_with_v["detection_data"]["vehicle_present"] == True
    assert evt_with_v["detection_data"]["plate_number"] == "KA01AB1234"
    print("✅ Test G Passed: Event payloads accurately reflect vehicle association.")

    # -------------------------------------------------------------
    # Test H: Camera worker isolation
    # -------------------------------------------------------------
    print("\n--- Test H: Camera worker isolation ---")
    worker1 = CameraWorker({"camera_id": "cam_worker_01", "stream_url": "http://127.0.0.1:9991/video"})
    worker2 = CameraWorker({"camera_id": "cam_worker_02", "stream_url": "http://127.0.0.1:9992/video"})

    assert worker1.camera_id != worker2.camera_id
    assert worker1.person_threat_results is not worker2.person_threat_results
    assert worker1.event_manager.camera_id == "cam_worker_01"
    assert worker2.event_manager.camera_id == "cam_worker_02"
    print("✅ Test H Passed: Per-camera worker isolation verified.")

    print("\n=" * 60)
    print("🎉 ALL ENTITY ASSOCIATION REGRESSION TESTS PASSED (A-H)!")
    print("=" * 60)

if __name__ == "__main__":
    run_entity_association_tests()
