import time
import queue
import threading
import requests
import logging
import os

try:
    from incident_recorder import IncidentRecorder
except ImportError:
    from src.incident_recorder import IncidentRecorder

try:
    from config import settings
except ImportError:
    from src.config import settings


logger = logging.getLogger("IBVAP.EventDispatcher")


class EventDispatcher:
    """
    Non-blocking background HTTP Event Dispatcher.

    AI events are placed into a queue and delivered asynchronously
    to the Go backend.

    The dispatcher converts the AI event structure into the structure
    expected by the Go backend Event API.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(EventDispatcher, cls).__new__(cls)
                cls._instance._initialized = False

            return cls._instance

    def __init__(self):
        if self._initialized:
            return

        with self._lock:
            if self._initialized:
                return

            self.event_queue = queue.Queue(maxsize=1000)

            # Backend configuration
            self.backend_url = settings.BACKEND_AI_EVENT_URL
            self.auth_token = settings.AI_SERVICE_TOKEN

            # Camera configuration
            self.camera_id = getattr(settings, "CAMERA_ID", 1)

            self.running = True

            self.worker_thread = threading.Thread(
                target=self._dispatch_loop,
                daemon=True
            )

            self.worker_thread.start()

            self._initialized = True

            print(
                f"📡 Event Dispatcher initialized. "
                f"Target Backend: {self.backend_url}"
            )

            print(
                f"📷 Configured Camera ID: {self.camera_id}"
            )

    # ============================================================
    # PUBLIC DISPATCH METHOD
    # ============================================================

    def dispatch(self, event_record: dict, incident_recorder=None):
        """
        Asynchronously enqueue an AI event.

        This method does NOT perform HTTP communication directly,
        so the video-processing thread is not blocked.
        """

        if not event_record:
            return

        # Use configured camera ID if the event does not contain one.
        if not event_record.get("camera_id"):
            event_record["camera_id"] = self.camera_id

        event_record["_incident_recorder"] = incident_recorder

        try:
            self.event_queue.put_nowait(event_record)

        except queue.Full:
            print(
                "⚠️ Warning: Event queue full! "
                "Dropping oldest event."
            )

            try:
                self.event_queue.get_nowait()
                self.event_queue.task_done()

                self.event_queue.put_nowait(event_record)

            except Exception as exc:
                print(
                    f"⚠️ Failed to recover from full event queue: {exc}"
                )

    # ============================================================
    # AI EVENT → BACKEND EVENT CONVERSION
    # ============================================================

    def _build_backend_payload(self, event_record: dict) -> dict:
        """
        Convert the AI engine's event structure into the structure
        expected by the Go backend Event API.

        AI format contains:
            event_type
            detection_data

        Backend format contains:
            type
            individual detection fields
        """

        detection_data = event_record.get("detection_data") or {}

        # --------------------------------------------------------
        # CAMERA ID
        # --------------------------------------------------------

        camera_id = event_record.get(
            "camera_id",
            self.camera_id
        )

        try:
            camera_id = int(camera_id)
        except (TypeError, ValueError):
            camera_id = int(self.camera_id)

        # --------------------------------------------------------
        # EVENT TYPE
        # --------------------------------------------------------

        event_type = event_record.get(
            "event_type",
            "UNKNOWN_EVENT"
        )

        # --------------------------------------------------------
        # SEVERITY
        # --------------------------------------------------------

        severity = event_record.get(
            "severity",
            "LOW"
        )

        # --------------------------------------------------------
        # THREAT SCORE
        # --------------------------------------------------------

        threat_score = event_record.get(
            "threat_score",
            0
        )

        try:
            threat_score = int(threat_score)
        except (TypeError, ValueError):
            threat_score = 0

        # --------------------------------------------------------
        # THREAT LEVEL
        # --------------------------------------------------------

        threat_level = event_record.get("threat_level")

        if not threat_level:
            if threat_score >= 70:
                threat_level = "HIGH"

            elif threat_score >= 40:
                threat_level = "MEDIUM"

            else:
                threat_level = "LOW"

        # --------------------------------------------------------
        # CONFIDENCE
        # --------------------------------------------------------

        confidence = event_record.get(
            "confidence",
            detection_data.get("confidence", 0.0)
        )

        try:
            confidence = float(confidence)
        except (TypeError, ValueError):
            confidence = 0.0

        # --------------------------------------------------------
        # PERSON ID
        # --------------------------------------------------------

        person_id = event_record.get("person_id")

        if person_id is not None:
            try:
                person_id = int(person_id)
            except (TypeError, ValueError):
                person_id = None

        # --------------------------------------------------------
        # VEHICLE ID
        # --------------------------------------------------------

        vehicle_id = event_record.get("vehicle_id")

        if vehicle_id is not None:
            try:
                vehicle_id = int(vehicle_id)
            except (TypeError, ValueError):
                vehicle_id = None

        # --------------------------------------------------------
        # VEHICLE INFORMATION
        # --------------------------------------------------------

        vehicle_present = detection_data.get(
            "vehicle_present",
            False
        )

        vehicle_type = detection_data.get(
            "vehicle_type",
            ""
        )

        # --------------------------------------------------------
        # NUMBER PLATE INFORMATION
        # --------------------------------------------------------

        plate_number = detection_data.get(
            "plate_number",
            ""
        )

        plate_country = detection_data.get(
            "plate_country",
            ""
        )

        plate_confidence = detection_data.get(
            "plate_confidence",
            0.0
        )

        try:
            plate_confidence = float(plate_confidence)
        except (TypeError, ValueError):
            plate_confidence = 0.0

        # --------------------------------------------------------
        # ZONE INFORMATION
        # --------------------------------------------------------

        zone_status = detection_data.get(
            "zone_status",
            ""
        )

        # --------------------------------------------------------
        # OBJECT INFORMATION
        # --------------------------------------------------------

        object_name = detection_data.get(
            "object_name",
            ""
        )

        carried_object = detection_data.get(
            "carried_object",
            False
        )

        # --------------------------------------------------------
        # MESSAGE
        # --------------------------------------------------------

        message = event_record.get("message")

        if not message:
            message = f"AI detected event: {event_type}"

        # --------------------------------------------------------
        # BUILD BACKEND PAYLOAD
        # --------------------------------------------------------

        backend_payload = {
            "camera_id": camera_id,

            "type": event_type,

            "severity": severity,

            "message": message,

            "timestamp": event_record.get(
                "timestamp"
            ),

            # Original AI event UUID
            "event_id": event_record.get(
                "event_id",
                ""
            ),

            "confidence": confidence,

            # Person
            "person_id": person_id,

            # Vehicle
            "vehicle_id": vehicle_id,

            # Zone
            "zone_status": zone_status,

            # Object
            "object_name": object_name,

            "carried_object": carried_object,

            # Vehicle
            "vehicle_present": vehicle_present,

            "vehicle_type": vehicle_type,

            # Number plate
            "plate_number": plate_number,

            "plate_country": plate_country,

            "plate_confidence": plate_confidence,

            # Threat
            "threat_score": threat_score,

            "threat_level": threat_level,

            # Evidence
            "evidence_image": event_record.get(
                "evidence_image",
                ""
            ),

            "incident_clip": event_record.get(
                "incident_clip",
                ""
            )
        }

        return backend_payload

    # ============================================================
    # BACKGROUND DISPATCH LOOP
    # ============================================================

    def _dispatch_loop(self):
        """
        Background worker that sends queued events to the Go backend.
        """

        session = requests.Session()

        headers = {
            "Content-Type": "application/json"
        }

        # Only send authentication headers when a token exists.
        if self.auth_token:
            headers["X-AI-Service-Token"] = self.auth_token
            headers["Authorization"] = (
                f"Bearer {self.auth_token}"
            )

        while self.running:

            try:
                event_record = self.event_queue.get(
                    timeout=1.0
                )

            except queue.Empty:
                continue

            # ----------------------------------------------------
            # Convert AI event → Backend payload
            # ----------------------------------------------------

            backend_payload = self._build_backend_payload(
                event_record
            )

            camera_id = backend_payload.get(
                "camera_id",
                "unknown"
            )

            event_id = backend_payload.get(
                "event_id",
                "unknown"
            )

            event_type = backend_payload.get(
                "type",
                "UNKNOWN_EVENT"
            )

            threat_level = backend_payload.get(
                "threat_level",
                "UNKNOWN"
            )

            threat_score = backend_payload.get(
                "threat_score",
                0
            )

            print(
                f"📤 Sending AI event to backend: "
                f"{event_type} | "
                f"Threat: {threat_level} | "
                f"Score: {threat_score}"
            )

            # ----------------------------------------------------
            # Retry configuration
            # ----------------------------------------------------

            success = False

            attempts = 0

            max_attempts = 3

            backoff = 1.0

            # ----------------------------------------------------
            # HTTP DELIVERY
            # ----------------------------------------------------

            while (
                attempts < max_attempts
                and self.running
            ):

                attempts += 1

                try:

                    response = session.post(
                        self.backend_url,
                        json=backend_payload,
                        headers=headers,
                        timeout=5.0
                    )

                    # ------------------------------------------------
                    # SUCCESS
                    # ------------------------------------------------

                    if response.status_code in (200, 201, 202):
                        success = True

                        try:
                            response_data = response.json()
                            backend_event = response_data.get("event", {})

                            backend_event_id = backend_event.get("id")

                            if backend_event_id is not None:
                                event_record["backend_event_id"] = backend_event_id
                                print(
                                    f"[{camera_id}] ✅ Event created in Go backend "
                                    f"(AI ID: {event_id}, Backend ID: {backend_event_id})"
                                )

                                incident_recorder = event_record.get("_incident_recorder")

                                if incident_recorder is not None:
                                    incident_recorder.set_backend_event_id(
                                        event_id,
                                        int(backend_event_id)
                                    )

                                self._upload_evidence_image(
                                    event_record,
                                    backend_event_id
                                )
                            else:
                                print(
                                    f"[{camera_id}] ⚠️ Backend created event but returned no numeric ID"
                                )

                        except Exception as parse_err:
                            print(
                                f"[{camera_id}] ⚠️ Could not parse backend event response: {parse_err}"
                            )

                        break

                        success = True

                        print(
                            f"[Camera {camera_id}] "
                            f"✅ Backend accepted event "
                            f"(HTTP {response.status_code}) "
                            f"Type: {event_type} "
                            f"ID: {event_id}"
                        )

                        break

                    # ------------------------------------------------
                    # FAILURE RESPONSE
                    # ------------------------------------------------

                    else:

                        print(
                            f"[Camera {camera_id}] "
                            f"⚠️ Backend returned "
                            f"HTTP {response.status_code} "
                            f"for event {event_id}"
                        )

                        # Print backend response when available.
                        try:
                            print(
                                f"Backend response: "
                                f"{response.text}"
                            )
                        except Exception:
                            pass

                # ----------------------------------------------------
                # REQUEST ERROR
                # ----------------------------------------------------

                except requests.RequestException as req_err:

                    print(
                        f"[Camera {camera_id}] "
                        f"⚠️ Backend delivery failed "
                        f"(attempt {attempts}/"
                        f"{max_attempts}): "
                        f"{req_err}"
                    )

                except Exception as exc:

                    print(
                        f"[Camera {camera_id}] "
                        f"⚠️ Unexpected dispatcher error "
                        f"(attempt {attempts}/"
                        f"{max_attempts}): "
                        f"{exc}"
                    )

                # ----------------------------------------------------
                # EXPONENTIAL BACKOFF
                # ----------------------------------------------------

                if (
                    not success
                    and attempts < max_attempts
                ):

                    time.sleep(backoff)

                    backoff *= 2.0

            # --------------------------------------------------------
            # FINAL FAILURE
            # --------------------------------------------------------

            if not success:

                print(
                    f"[Camera {camera_id}] "
                    f"❌ Event delivery failed after "
                    f"{max_attempts} attempts. "
                    f"Event ID: {event_id}"
                )

            # --------------------------------------------------------
            # MARK QUEUE ITEM COMPLETE
            # --------------------------------------------------------

            self.event_queue.task_done()

        # ============================================================
    # EVIDENCE IMAGE → BACKEND UPLOAD
    # ============================================================

    def _upload_evidence_image(self, event_record: dict, backend_event_id: int):
        """
        Upload the AI-generated evidence image to the Go backend.

        Uses the numeric database event ID returned by the backend.
        Runs inside the dispatcher worker, so the main AI/video thread
        remains non-blocking.
        """

        evidence_image = event_record.get("evidence_image")

        if not evidence_image:
            print(
                f"[Camera {event_record.get('camera_id', 'unknown')}] "
                f"⚠️ No evidence image available for event "
                f"{backend_event_id}"
            )
            return False

        # Convert AI relative evidence path to an absolute local path.
        image_path = evidence_image

        if not os.path.isabs(image_path):
            image_path = os.path.join(
                settings.BASE_DIR,
                image_path
            )

        image_path = os.path.normpath(image_path)

        if not os.path.isfile(image_path):
            print(
                f"[Camera {event_record.get('camera_id', 'unknown')}] "
                f"❌ Evidence image not found: {image_path}"
            )
            return False

        # Explicit evidence upload URL from settings if available.
        upload_url = getattr(
            settings,
            "BACKEND_EVIDENCE_UPLOAD_URL",
            None
        )

        # Fallback: derive upload URL from the existing event URL.
        if not upload_url:
            event_url = self.backend_url.rstrip("/")

            if event_url.endswith("/events"):
                upload_url = event_url[:-len("/events")] + "/evidence/upload"
            else:
                upload_url = event_url + "/evidence/upload"

        upload_headers = {}

        if self.auth_token:
            upload_headers["X-AI-Service-Token"] = self.auth_token
            upload_headers["Authorization"] = (
                f"Bearer {self.auth_token}"
            )

        max_attempts = 3
        backoff = 1.0

        for attempt in range(1, max_attempts + 1):

            try:
                with open(image_path, "rb") as image_file:

                    files = {
                        "file": (
                            os.path.basename(image_path),
                            image_file,
                            "image/jpeg"
                        )
                    }

                    data = {
                        "event_id": str(backend_event_id),
                        "type": "image"
                    }

                    response = requests.post(
                        upload_url,
                        files=files,
                        data=data,
                        headers=upload_headers,
                        timeout=10.0
                    )

                if response.status_code in (200, 201, 202):

                    print(
                        f"[Camera {event_record.get('camera_id', 'unknown')}] "
                        f"✅ Evidence image uploaded "
                        f"(Backend Event ID: {backend_event_id})"
                    )

                    return True

                print(
                    f"[Camera {event_record.get('camera_id', 'unknown')}] "
                    f"⚠️ Evidence upload returned "
                    f"HTTP {response.status_code} "
                    f"(attempt {attempt}/{max_attempts})"
                )

                try:
                    print(f"Backend response: {response.text}")
                except Exception:
                    pass

            except requests.RequestException as exc:

                print(
                    f"[Camera {event_record.get('camera_id', 'unknown')}] "
                    f"⚠️ Evidence upload failed "
                    f"(attempt {attempt}/{max_attempts}): {exc}"
                )

            except Exception as exc:

                print(
                    f"[Camera {event_record.get('camera_id', 'unknown')}] "
                    f"❌ Unexpected evidence upload error: {exc}"
                )

            if attempt < max_attempts:
                time.sleep(backoff)
                backoff *= 2.0

        print(
            f"[Camera {event_record.get('camera_id', 'unknown')}] "
            f"❌ Evidence image upload failed after "
            f"{max_attempts} attempts"
        )

        return False

    # ============================================================
    # SHUTDOWN
    # ============================================================

    def shutdown(self):
        """
        Stop the background dispatcher gracefully.
        """

        print("🛑 Shutting down Event Dispatcher...")

        self.running = False

        if self.worker_thread.is_alive():

            self.worker_thread.join(
                timeout=2.0
            )

        print("✅ Event Dispatcher stopped.")


# ================================================================
# SINGLETON ACCESSOR
# ================================================================

def get_event_dispatcher() -> EventDispatcher:
    """
    Return the singleton EventDispatcher instance.
    """

    return EventDispatcher()