import os
from pathlib import Path
from dotenv import load_dotenv

# Find and load .env file if available
BASE_DIR = Path(__file__).resolve().parent.parent
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


class Settings:
    """
    Production configuration settings for IBVAP AI Engine.
    All parameters are dynamically configured via environment variables.
    """
    # Service Settings
    AI_SERVICE_HOST: str = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    AI_SERVICE_PORT: int = int(os.getenv("AI_SERVICE_PORT", "8001"))
    AI_SERVICE_TOKEN: str = os.getenv("AI_SERVICE_TOKEN", "ibvap_secret_service_token_2026")

    # Backend Integration Webhook
    BACKEND_AI_EVENT_URL: str = os.getenv("BACKEND_AI_EVENT_URL", "http://localhost:8080/api/events")
    BACKEND_EVIDENCE_UPLOAD_URL: str = os.getenv("BACKEND_EVIDENCE_UPLOAD_URL", "http://localhost:8080/api/evidence/upload")
    CAMERA_ID: int = int(os.getenv("CAMERA_ID", "1"))

    # Headless / GUI Mode
    DISPLAY_ENABLED: bool = os.getenv("DISPLAY_ENABLED", "false").lower() in ("true", "1", "t", "yes")

    # Storage & Directories
    BASE_DIR: Path = BASE_DIR
    EVIDENCE_DIRECTORY: str = os.getenv("EVIDENCE_DIRECTORY", "events")
    EVIDENCE_DIR: Path = BASE_DIR / EVIDENCE_DIRECTORY / "evidence"
    CLIPS_DIR: Path = BASE_DIR / EVIDENCE_DIRECTORY / "clips"
    JSON_DIR: Path = BASE_DIR / EVIDENCE_DIRECTORY / "json"

    # Runtime Settings
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    RECONNECT_DELAY: float = float(os.getenv("RECONNECT_DELAY", "3.0"))
    MAX_RECONNECT_ATTEMPTS: int = int(os.getenv("MAX_RECONNECT_ATTEMPTS", "10"))


settings = Settings()
