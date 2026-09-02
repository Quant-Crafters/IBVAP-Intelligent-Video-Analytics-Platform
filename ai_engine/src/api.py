from fastapi import FastAPI, HTTPException, Header, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

try:
    from config import settings
    from camera_manager import get_camera_manager
except ImportError:
    from src.config import settings
    from src.camera_manager import get_camera_manager

app = FastAPI(
    title="IBVAP AI Engine Service",
    description="Intelligent Border Video Analytics Platform — Production AI Engine API",
    version="1.0.0"
)

camera_manager = get_camera_manager()


# -----------------------------------------------------------------------------
# Security Dependency
# -----------------------------------------------------------------------------
def verify_token(x_ai_service_token: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    token = x_ai_service_token
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.split("Bearer ")[1].strip()
        else:
            token = authorization.strip()

    if token != settings.AI_SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing AI Service Authentication Token"
        )


# -----------------------------------------------------------------------------
# Request Schemas
# -----------------------------------------------------------------------------
class CameraStartRequest(BaseModel):
    camera_id: str = Field(..., example="cam_001")
    name: Optional[str] = Field("Gate Camera 1", example="Gate Camera 1")
    stream_url: str = Field(..., example="http://192.168.1.105:8080/video")
    camera_type: Optional[str] = Field("ip_webcam", example="ip_webcam")
    enabled: Optional[bool] = Field(True, example=True)
    zone: Optional[List[List[int]]] = Field(None, example=[[120, 100], [500, 100], [550, 400], [100, 400]])


class CameraConfigRequest(BaseModel):
    name: Optional[str] = Field(None, example="Updated Gate Camera 1")
    stream_url: Optional[str] = Field(None, example="http://192.168.1.112:8080/video")
    camera_type: Optional[str] = Field(None, example="ip_webcam")
    enabled: Optional[bool] = Field(None, example=True)
    zone: Optional[List[List[int]]] = Field(None, example=[[120, 100], [500, 100], [550, 400], [100, 400]])


class CameraZoneRequest(BaseModel):
    zone: List[List[int]] = Field(..., example=[[120, 100], [500, 100], [550, 400], [100, 400]])


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@app.get("/health", status_code=200)
def health_check():
    """
    Health Check Endpoint.
    Confirms AI Service is alive and reports camera worker summaries.
    """
    cameras = camera_manager.get_all_statuses()
    total_cameras = len(cameras)
    running_cameras = sum(1 for c in cameras if c["state"] == "RUNNING")

    return {
        "status": "healthy",
        "service": "IBVAP AI Engine",
        "timestamp": datetime.now().astimezone().isoformat(),
        "backend_webhook": settings.BACKEND_AI_EVENT_URL,
        "headless_mode": not settings.DISPLAY_ENABLED,
        "cameras_summary": {
            "total": total_cameras,
            "running": running_cameras,
            "details": cameras
        }
    }


@app.post("/api/v1/cameras/start", status_code=200, dependencies=[Depends(verify_token)])
def start_camera(req: CameraStartRequest):
    """
    Start or register a camera worker given camera configuration.
    """
    try:
        status_info = camera_manager.start_camera(req.model_dump())
        return {
            "message": f"Camera '{req.camera_id}' started successfully",
            "camera": status_info
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start camera: {e}")


@app.post("/api/v1/cameras/{camera_id}/stop", status_code=200, dependencies=[Depends(verify_token)])
def stop_camera(camera_id: str):
    """
    Stop an active camera worker.
    """
    try:
        status_info = camera_manager.stop_camera(camera_id)
        return {
            "message": f"Camera '{camera_id}' stopped successfully",
            "camera": status_info
        }
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop camera: {e}")


@app.post("/api/v1/cameras/{camera_id}/restart", status_code=200, dependencies=[Depends(verify_token)])
def restart_camera(camera_id: str):
    """
    Restart a camera worker.
    """
    try:
        status_info = camera_manager.restart_camera(camera_id)
        return {
            "message": f"Camera '{camera_id}' restarted successfully",
            "camera": status_info
        }
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restart camera: {e}")


@app.put("/api/v1/cameras/{camera_id}/config", status_code=200, dependencies=[Depends(verify_token)])
def update_camera_config(camera_id: str, req: CameraConfigRequest):
    """
    Update camera configuration (e.g. stream_url when IP changes).
    """
    try:
        update_data = {k: v for k, v in req.model_dump().items() if v is not None}
        status_info = camera_manager.update_camera_config(camera_id, update_data)
        return {
            "message": f"Camera '{camera_id}' configuration updated",
            "camera": status_info
        }
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update camera configuration: {e}")


@app.put("/api/v1/cameras/{camera_id}/zone", status_code=200, dependencies=[Depends(verify_token)])
def update_camera_zone(camera_id: str, req: CameraZoneRequest):
    """
    Update restricted zone polygon coordinates for camera_id.
    """
    try:
        status_info = camera_manager.update_camera_zone(camera_id, req.zone)
        return {
            "message": f"Camera '{camera_id}' zone updated",
            "camera": status_info
        }
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update zone: {e}")


@app.get("/api/v1/cameras", status_code=200, dependencies=[Depends(verify_token)])
def list_cameras():
    """
    List all registered camera workers and their statuses.
    """
    cameras = camera_manager.get_all_statuses()
    return {
        "count": len(cameras),
        "cameras": cameras
    }


@app.get("/api/v1/cameras/{camera_id}", status_code=200, dependencies=[Depends(verify_token)])
def get_camera(camera_id: str):
    """
    Get status for a specific camera worker.
    """
    try:
        return camera_manager.get_camera_status(camera_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")
