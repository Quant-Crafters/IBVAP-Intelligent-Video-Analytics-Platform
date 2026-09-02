import os
import sys
import uvicorn
import logging

# Ensure src directory is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from src.config import settings
from src.model_loader import get_model_loader
from src.event_dispatcher import get_event_dispatcher
from src.camera_manager import get_camera_manager
from src.api import app

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("IBVAP.Main")


def main():
    print("=" * 60)
    print("🚀 IBVAP AI ENGINE SERVICE STARTING")
    print("=" * 60)
    print(f"Host              : {settings.AI_SERVICE_HOST}")
    print(f"Port              : {settings.AI_SERVICE_PORT}")
    print(f"Backend Webhook   : {settings.BACKEND_AI_EVENT_URL}")
    print(f"Auth Token        : {'*' * len(settings.AI_SERVICE_TOKEN)}")
    print(f"Headless Mode     : {not settings.DISPLAY_ENABLED}")
    print(f"Evidence Dir      : {settings.EVIDENCE_DIR}")
    print("=" * 60)

    # Pre-load shared singleton models
    print("📦 Pre-loading AI models...")
    get_model_loader()

    # Initialize Event Dispatcher & Camera Manager
    get_event_dispatcher()
    get_camera_manager()

    print("🌐 Launching HTTP API service...")
    uvicorn.run(
        app,
        host=settings.AI_SERVICE_HOST,
        port=settings.AI_SERVICE_PORT,
        log_level=settings.LOG_LEVEL.lower()
    )


if __name__ == "__main__":
    main()
