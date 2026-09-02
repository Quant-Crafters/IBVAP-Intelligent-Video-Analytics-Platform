import cv2
import json
import os
import threading
import time
import requests

from collections import deque
from pathlib import Path

try:
    from config import settings
except ImportError:
    from src.config import settings


# ============================================================
# CONFIGURATION
# ============================================================

CLIP_PRE_EVENT_SECONDS = 5
CLIP_POST_EVENT_SECONDS = 5


class IncidentRecorder:
    """
    Non-blocking Incident Video Clip Recorder for IBVAP AI Engine.

    Maintains a rolling memory buffer of pre-event frames and asynchronously
    records post-event frames into an MP4 video clip isolated per camera_id.

    After the clip is successfully created, it is automatically uploaded
    to the Go backend evidence endpoint using the numeric backend event ID.
    """

    def __init__(
        self,
        camera_id: str = "default_camera",
        base_dir=None,
        pre_event_sec=CLIP_PRE_EVENT_SECONDS,
        post_event_sec=CLIP_POST_EVENT_SECONDS
    ):
        self.camera_id = camera_id

        if base_dir is None:
            self.base_dir = settings.BASE_DIR
        else:
            self.base_dir = base_dir

        self.pre_event_sec = pre_event_sec
        self.post_event_sec = post_event_sec

        # ========================================================
        # STORAGE DIRECTORIES
        # ========================================================

        self.clips_dir = os.path.join(
            self.base_dir,
            settings.EVIDENCE_DIRECTORY,
            "clips",
            self.camera_id
        )

        self.json_dir = os.path.join(
            self.base_dir,
            settings.EVIDENCE_DIRECTORY,
            "json",
            self.camera_id
        )

        os.makedirs(self.clips_dir, exist_ok=True)
        os.makedirs(self.json_dir, exist_ok=True)

        # ========================================================
        # ROLLING PRE-EVENT BUFFER
        # ========================================================

        self.max_pre_frames = int(
            30.0 * self.pre_event_sec
        )

        self.rolling_buffer = deque(
            maxlen=self.max_pre_frames
        )

        # ========================================================
        # ACTIVE RECORDING SESSIONS
        # ========================================================

        self.active_sessions = []

        self.lock = threading.Lock()

        # ========================================================
        # BACKEND EVENT / VIDEO UPLOAD STATE
        # ========================================================

        # AI UUID -> numeric Go backend event ID
        self.backend_event_ids = {}

        # AI UUID -> completed MP4 absolute path
        self.completed_clips = {}

        # AI UUIDs whose video upload actually succeeded
        self.uploaded_clips = set()

    # ============================================================
    # FRAME BUFFER
    # ============================================================

    def update_buffer(self, frame, actual_fps=30.0):
        """
        Appends live frame to rolling pre-event memory buffer and collects
        post-event frames for active incident recording sessions.
        """

        if frame is None or frame.size == 0:
            return

        # Adjust rolling buffer size when FPS changes.
        expected_pre_frames = max(
            1,
            int(actual_fps * self.pre_event_sec)
        )

        if self.rolling_buffer.maxlen != expected_pre_frames:
            with self.lock:
                self.rolling_buffer = deque(
                    self.rolling_buffer,
                    maxlen=expected_pre_frames
                )

        frame_copy = frame.copy()

        completed_sessions = []

        with self.lock:
            self.rolling_buffer.append(frame_copy)

            # Collect post-event frames.
            for session in list(self.active_sessions):
                session["post_frames"].append(frame_copy)

                if (
                    len(session["post_frames"])
                    >= session["post_frames_needed"]
                ):
                    completed_sessions.append(session)
                    self.active_sessions.remove(session)

        # Start video-writing workers outside the lock.
        for session in completed_sessions:
            worker = threading.Thread(
                target=self._write_video_worker,
                args=(session,),
                daemon=True
            )
            worker.start()

    # ============================================================
    # TRIGGER INCIDENT CLIP
    # ============================================================

    def trigger_clip(
        self,
        event_id: str,
        event_type: str,
        actual_fps=30.0,
        frame_size=None,
        backend_event_id=None
    ):
        """
        Starts an incident recording session.

        Captures:
            - Previous 5 seconds from rolling buffer
            - Next 5 seconds after event

        backend_event_id is optional because the AI event may be created
        before the Go backend returns its numeric ID.
        """

        if not event_id:
            return

        with self.lock:
            pre_frames_snapshot = list(
                self.rolling_buffer
            )

            # If backend ID is already known, use it.
            if backend_event_id is None:
                backend_event_id = self.backend_event_ids.get(
                    event_id
                )
            else:
                self.backend_event_ids[event_id] = int(
                    backend_event_id
                )

        post_needed = max(
            1,
            int(actual_fps * self.post_event_sec)
        )

        session = {
            "event_id": event_id,
            "event_type": event_type,
            "pre_frames": pre_frames_snapshot,
            "post_frames": [],
            "post_frames_needed": post_needed,
            "actual_fps": actual_fps,
            "frame_size": frame_size,
            "backend_event_id": (
                int(backend_event_id)
                if backend_event_id is not None
                else None
            )
        }

        with self.lock:
            self.active_sessions.append(session)

        print("========================================")
        print(
            f"INCIDENT CLIP STARTED [{self.camera_id}]"
        )
        print("========================================")
        print(f"EVENT ID   : {event_id}")
        print(f"CAMERA ID  : {self.camera_id}")
        print(f"EVENT TYPE : {event_type}")
        print(f"PRE-EVENT  : {self.pre_event_sec} sec")
        print(f"POST-EVENT : {self.post_event_sec} sec")
        print("========================================")

    # ============================================================
    # BACKEND EVENT ID LINKING
    # ============================================================

    def set_backend_event_id(
        self,
        event_id: str,
        backend_event_id: int
    ):
        """
        Associates the numeric Go backend event ID with an active or
        completed incident recording session.

        If the MP4 is already completed, starts the upload immediately.
        """

        if not event_id or backend_event_id is None:
            return

        try:
            b_id = int(backend_event_id)
        except (TypeError, ValueError):
            print(
                f"[{self.camera_id}] "
                f"Invalid backend event ID: {backend_event_id}"
            )
            return

        clip_path = None
        should_upload = False

        with self.lock:
            self.backend_event_ids[event_id] = b_id

            # Update active recording session.
            for session in self.active_sessions:
                if session.get("event_id") == event_id:
                    session["backend_event_id"] = b_id

            print(
                f"[{self.camera_id}] "
                f"🔗 Backend Event ID linked: "
                f"AI ID={event_id}, Backend ID={b_id}"
            )

            # Check whether the MP4 was already completed.
            clip_path = self.completed_clips.get(event_id)

            # IMPORTANT:
            # Do NOT mark uploaded here.
            # uploaded_clips is updated only after successful upload.
            if clip_path and event_id not in self.uploaded_clips:
                self.uploaded_clips.add(event_id)
                should_upload = True

        # Update local JSON metadata.
        self._update_json_backend_id(
            event_id,
            b_id
        )

        print(
            f"[{self.camera_id}] VIDEO UPLOAD CHECK: "
            f"should_upload={should_upload}, "
            f"clip_path={clip_path}, "
            f"event_id={event_id}, "
            f"backend_id={b_id}"
        )

        # Start upload worker if clip already exists.
        if should_upload and clip_path:
            worker = threading.Thread(
                target=self._upload_video_worker,
                args=(
                    event_id,
                    b_id,
                    clip_path
                ),
                daemon=True
            )

            worker.start()

    # ============================================================
    # VIDEO WRITER WORKER
    # ============================================================

    def _write_video_worker(self, session):
        """
        Background worker.

        Combines:
            pre-event frames + post-event frames

        Writes and verifies MP4.

        Then:
            - Stores completed clip path
            - Uploads immediately if backend ID exists
            - Otherwise waits for backend ID
        """

        event_id = session["event_id"]

        pre_frames = session["pre_frames"]
        post_frames = session["post_frames"]

        all_frames = pre_frames + post_frames

        if not all_frames:
            self._update_json_clip_path(
                event_id,
                None
            )
            return

        fps = (
            float(session["actual_fps"])
            if session["actual_fps"] > 0
            else 30.0
        )

        sample_frame = all_frames[0]

        h, w = sample_frame.shape[:2]

        filename = f"{event_id}.mp4"

        abs_clip_path = os.path.join(
            self.clips_dir,
            filename
        )

        rel_clip_path = os.path.join(
            settings.EVIDENCE_DIRECTORY,
            "clips",
            self.camera_id,
            filename
        ).replace("\\", "/")

        success = False
        error_reason = "Unknown Error"

        # ========================================================
        # WINDOWS CODEC FALLBACKS
        # ========================================================

        codecs_to_try = [
            cv2.VideoWriter_fourcc(*"mp4v"),
            cv2.VideoWriter_fourcc(*"avc1"),
            cv2.VideoWriter_fourcc(*"XVID")
        ]

        writer = None

        for fourcc in codecs_to_try:
            try:
                writer = cv2.VideoWriter(
                    abs_clip_path,
                    fourcc,
                    fps,
                    (w, h)
                )

                if writer is not None and writer.isOpened():
                    break

            except Exception as exc:
                error_reason = str(exc)
                writer = None

        # ========================================================
        # WRITE VIDEO
        # ========================================================

        if writer is not None and writer.isOpened():
            try:
                for frame in all_frames:
                    writer.write(frame)

                writer.release()

                # Verify file.
                if (
                    Path(abs_clip_path).exists()
                    and Path(abs_clip_path).stat().st_size > 0
                ):
                    success = True
                else:
                    error_reason = (
                        "MP4 file created but size is 0 bytes"
                    )

            except Exception as exc:
                error_reason = str(exc)

                try:
                    if writer:
                        writer.release()
                except Exception:
                    pass

        else:
            error_reason = (
                "Failed to initialize OpenCV VideoWriter "
                "with available codecs"
            )

        # ========================================================
        # SUCCESS
        # ========================================================

        if success:
            duration = len(all_frames) / fps

            self._update_json_clip_path(
                event_id,
                rel_clip_path
            )

            print("========================================")
            print(
                f"INCIDENT CLIP SAVED [{self.camera_id}]"
            )
            print("========================================")
            print(f"EVENT ID   : {event_id}")
            print(f"CAMERA ID  : {self.camera_id}")
            print(
                f"CLIP       : "
                f"{os.path.abspath(abs_clip_path)}"
            )
            print(
                f"DURATION   : {duration:.1f} sec"
            )
            print("========================================")

            should_upload = False
            backend_id = None

            with self.lock:
                # Store completed clip.
                self.completed_clips[event_id] = (
                    abs_clip_path
                )

                # First check session.
                backend_id = session.get(
                    "backend_event_id"
                )

                # Then mapping.
                if backend_id is None:
                    backend_id = self.backend_event_ids.get(
                        event_id
                    )

                # IMPORTANT:
                # Do NOT add to uploaded_clips yet.
                # Only successful upload adds it.
                if backend_id is not None:
                    if event_id not in self.uploaded_clips:
                        should_upload = True

            if should_upload:
                self._upload_video_worker(
                    event_id,
                    backend_id,
                    abs_clip_path
                )

            else:
                # Backend event may not have been created yet.
                with self.lock:
                    already_uploaded = (
                        event_id in self.uploaded_clips
                    )

                if not already_uploaded:
                    wait_thread = threading.Thread(
                        target=self._wait_and_upload_worker,
                        args=(
                            event_id,
                            abs_clip_path
                        ),
                        daemon=True
                    )

                    wait_thread.start()

        # ========================================================
        # SAVE FAILURE
        # ========================================================

        else:
            self._update_json_clip_path(
                event_id,
                None
            )

            print("========================================")
            print(
                f"INCIDENT CLIP SAVE FAILED "
                f"[{self.camera_id}]"
            )
            print("========================================")
            print(f"EVENT ID   : {event_id}")
            print(f"CAMERA ID  : {self.camera_id}")
            print(
                f"PATH       : "
                f"{os.path.abspath(abs_clip_path)}"
            )
            print(f"REASON     : {error_reason}")
            print("========================================")

    # ============================================================
    # WAIT FOR BACKEND EVENT ID
    # ============================================================

    def _wait_and_upload_worker(self, event_id: str, clip_path: str, timeout: float = 30.0):
        """
        Wait for the numeric Go backend event ID before uploading
        the completed incident video.
        """
        start = time.time()

        print("========================================")
        print(f"VIDEO EVIDENCE UPLOAD WAITING [{self.camera_id}]")
        print(f"AI EVENT ID : {event_id}")
        print("Waiting for Backend Event ID...")
        print("========================================")

        while time.time() - start < timeout:

            with self.lock:
                # Backend ID may have been assigned by EventDispatcher
                backend_id = self.backend_event_ids.get(event_id)

                # If another worker already uploaded it, stop.
                if event_id in self.uploaded_clips:
                    return

            if backend_id is not None:
                print("========================================")
                print(f"VIDEO EVIDENCE BACKEND ID RECEIVED [{self.camera_id}]")
                print(f"AI EVENT ID     : {event_id}")
                print(f"BACKEND ID      : {backend_id}")
                print("========================================")

                with self.lock:
                    # Mark as claimed for upload
                    self.uploaded_clips.add(event_id)

                self._upload_video_worker(
                    event_id,
                    int(backend_id),
                    clip_path
                )
                return

            time.sleep(0.5)

        print("========================================")
        print(f"VIDEO EVIDENCE UPLOAD WAIT TIMEOUT [{self.camera_id}]")
        print(f"AI EVENT ID : {event_id}")
        print("Backend numeric event ID was not received in time.")
        print("========================================")
    # ============================================================
    # VIDEO EVIDENCE UPLOAD
    # ============================================================

    def _upload_video_worker(
        self,
        event_id: str,
        backend_event_id: int,
        clip_path: str
    ):
        """
        Uploads completed MP4 incident clip to Go backend.

        Multipart payload:

            event_id = numeric backend event ID
            type     = video
            file     = MP4

        Returns:
            True  -> upload successful
            False -> upload failed
        """

        # ========================================================
        # VALIDATE BACKEND EVENT ID
        # ========================================================

        if backend_event_id is None:
            print("========================================")
            print(
                f"VIDEO EVIDENCE UPLOAD FAILED "
                f"[{self.camera_id}]"
            )
            print("========================================")
            print(f"AI EVENT ID     : {event_id}")
            print("BACKEND EVENT ID: None")
            print(
                "REASON          : "
                "Backend event ID is missing"
            )
            print("========================================")

            return False

        try:
            backend_event_id = int(
                backend_event_id
            )
        except (TypeError, ValueError):
            print("========================================")
            print(
                f"VIDEO EVIDENCE UPLOAD FAILED "
                f"[{self.camera_id}]"
            )
            print("========================================")
            print(f"AI EVENT ID     : {event_id}")
            print(
                f"BACKEND EVENT ID: "
                f"{backend_event_id}"
            )
            print(
                "REASON          : "
                "Invalid backend event ID"
            )
            print("========================================")

            return False

        # ========================================================
        # VALIDATE FILE
        # ========================================================

        if not clip_path:
            print("========================================")
            print(
                f"VIDEO EVIDENCE UPLOAD FAILED "
                f"[{self.camera_id}]"
            )
            print("========================================")
            print(f"AI EVENT ID     : {event_id}")
            print(
                f"BACKEND EVENT ID: "
                f"{backend_event_id}"
            )
            print(
                "REASON          : "
                "Clip path is empty"
            )
            print("========================================")

            return False

        if not os.path.exists(clip_path):
            print("========================================")
            print(
                f"VIDEO EVIDENCE UPLOAD FAILED "
                f"[{self.camera_id}]"
            )
            print("========================================")
            print(f"AI EVENT ID     : {event_id}")
            print(
                f"BACKEND EVENT ID: "
                f"{backend_event_id}"
            )
            print(
                f"FILE            : {clip_path}"
            )
            print(
                "REASON          : "
                "MP4 file does not exist"
            )
            print("========================================")

            return False

        try:
            file_size = os.path.getsize(
                clip_path
            )

        except OSError as exc:
            print("========================================")
            print(
                f"VIDEO EVIDENCE UPLOAD FAILED "
                f"[{self.camera_id}]"
            )
            print("========================================")
            print(f"AI EVENT ID     : {event_id}")
            print(
                f"BACKEND EVENT ID: "
                f"{backend_event_id}"
            )
            print(
                f"ERROR           : {exc}"
            )
            print("========================================")

            return False

        if file_size <= 0:
            print("========================================")
            print(
                f"VIDEO EVIDENCE UPLOAD FAILED "
                f"[{self.camera_id}]"
            )
            print("========================================")
            print(f"AI EVENT ID     : {event_id}")
            print(
                f"BACKEND EVENT ID: "
                f"{backend_event_id}"
            )
            print(
                "REASON          : "
                "MP4 file is 0 bytes"
            )
            print("========================================")

            return False

        # ========================================================
        # GET UPLOAD URL
        # ========================================================

        upload_url = getattr(
            settings,
            "BACKEND_EVIDENCE_UPLOAD_URL",
            None
        )

        if not upload_url:

            event_url = getattr(
                settings,
                "BACKEND_AI_EVENT_URL",
                ""
            )

            if event_url.endswith("/events"):
                upload_url = (
                    event_url[
                        :-len("/events")
                    ]
                    + "/evidence/upload"
                )

            elif event_url:
                upload_url = (
                    event_url
                    + "/evidence/upload"
                )

        if not upload_url:
            print("========================================")
            print(
                f"VIDEO EVIDENCE UPLOAD FAILED "
                f"[{self.camera_id}]"
            )
            print("========================================")
            print(f"AI EVENT ID     : {event_id}")
            print(
                f"BACKEND EVENT ID: "
                f"{backend_event_id}"
            )
            print(
                "REASON          : "
                "Evidence upload URL is not configured"
            )
            print("========================================")

            return False

        # ========================================================
        # HEADERS
        # ========================================================

        token = getattr(
            settings,
            "AI_SERVICE_TOKEN",
            ""
        )

        headers = {}

        if token:
            headers[
                "X-AI-Service-Token"
            ] = token

            headers[
                "Authorization"
            ] = f"Bearer {token}"

        # ========================================================
        # START LOG
        # ========================================================

        print("========================================")
        print(
            f"VIDEO EVIDENCE UPLOAD STARTED "
            f"[{self.camera_id}]"
        )
        print("========================================")
        print(f"AI EVENT ID     : {event_id}")
        print(
            f"BACKEND EVENT ID: "
            f"{backend_event_id}"
        )
        print(
            f"FILE            : "
            f"{os.path.abspath(clip_path)}"
        )
        print(
            f"FILE SIZE       : "
            f"{file_size} bytes"
        )
        print(
            f"TARGET URL      : "
            f"{upload_url}"
        )
        print("========================================")

        # ========================================================
        # UPLOAD
        # ========================================================

        try:
            with open(
                clip_path,
                "rb"
            ) as video_file:

                files = {
                    "file": (
                        os.path.basename(
                            clip_path
                        ),
                        video_file,
                        "video/mp4"
                    )
                }

                data = {
                    "event_id": str(
                        backend_event_id
                    ),
                    "type": "video"
                }

                response = requests.post(
                    upload_url,
                    files=files,
                    data=data,
                    headers=headers,
                    timeout=15.0
                )

            # ====================================================
            # SUCCESS
            # ====================================================

            if response.status_code in (
                200,
                201,
                202
            ):

                # IMPORTANT:
                # Only mark uploaded after successful HTTP response.
                with self.lock:
                    self.uploaded_clips.add(
                        event_id
                    )

                print("========================================")
                print(
                    f"VIDEO EVIDENCE UPLOAD SUCCESS "
                    f"[{self.camera_id}]"
                )
                print("========================================")
                print(
                    f"CAMERA ID       : "
                    f"{self.camera_id}"
                )
                print(
                    f"AI EVENT ID     : "
                    f"{event_id}"
                )
                print(
                    f"BACKEND EVENT ID: "
                    f"{backend_event_id}"
                )
                print(
                    f"HTTP STATUS     : "
                    f"{response.status_code}"
                )
                print("========================================")

                return True

            # ====================================================
            # HTTP FAILURE
            # ====================================================

            print("========================================")
            print(
                f"VIDEO EVIDENCE UPLOAD FAILED "
                f"[{self.camera_id}]"
            )
            print("========================================")
            print(
                f"CAMERA ID       : "
                f"{self.camera_id}"
            )
            print(
                f"AI EVENT ID     : "
                f"{event_id}"
            )
            print(
                f"BACKEND EVENT ID: "
                f"{backend_event_id}"
            )
            print(
                f"HTTP STATUS     : "
                f"{response.status_code}"
            )

            try:
                print(
                    f"RESPONSE        : "
                    f"{response.text}"
                )
            except Exception:
                pass

            print("========================================")

            return False

        # ========================================================
        # NETWORK / FILE ERROR
        # ========================================================

        except Exception as exc:

            print("========================================")
            print(
                f"VIDEO EVIDENCE UPLOAD FAILED "
                f"[{self.camera_id}]"
            )
            print("========================================")
            print(
                f"CAMERA ID       : "
                f"{self.camera_id}"
            )
            print(
                f"AI EVENT ID     : "
                f"{event_id}"
            )
            print(
                f"BACKEND EVENT ID: "
                f"{backend_event_id}"
            )
            print(
                f"ERROR           : "
                f"{exc}"
            )
            print("========================================")

            return False

    # ============================================================
    # JSON BACKEND ID UPDATE
    # ============================================================

    def _update_json_backend_id(
        self,
        event_id: str,
        backend_event_id: int
    ):
        """
        Updates event JSON metadata with numeric backend event ID.
        """

        json_path = os.path.join(
            self.json_dir,
            f"{event_id}.json"
        )

        if not os.path.exists(json_path):
            return

        try:
            with open(
                json_path,
                "r",
                encoding="utf-8"
            ) as f:
                data = json.load(f)

            data["backend_event_id"] = int(
                backend_event_id
            )

            with open(
                json_path,
                "w",
                encoding="utf-8"
            ) as f:
                json.dump(
                    data,
                    f,
                    indent=4
                )

        except Exception as exc:
            print(
                f"[{self.camera_id}] "
                f"JSON BACKEND ID UPDATE ERROR "
                f"for {event_id}: {exc}"
            )

    # ============================================================
    # JSON CLIP PATH UPDATE
    # ============================================================

    def _update_json_clip_path(
        self,
        event_id: str,
        rel_clip_path
    ):
        """
        Updates event JSON metadata with incident clip path.
        """

        json_path = os.path.join(
            self.json_dir,
            f"{event_id}.json"
        )

        if not os.path.exists(json_path):
            return

        try:
            with open(
                json_path,
                "r",
                encoding="utf-8"
            ) as f:
                data = json.load(f)

            data["incident_clip"] = rel_clip_path

            with open(
                json_path,
                "w",
                encoding="utf-8"
            ) as f:
                json.dump(
                    data,
                    f,
                    indent=4
                )

        except Exception as exc:
            print(
                f"[{self.camera_id}] "
                f"JSON UPDATE ERROR "
                f"for {event_id}: {exc}"
            )