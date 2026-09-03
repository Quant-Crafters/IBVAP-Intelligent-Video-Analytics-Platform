package camera

type CreateCameraRequest struct {
	CameraID   string `json:"camera_id" binding:"required"`
	Name       string `json:"name" binding:"required"`
	StreamURL  string `json:"stream_url" binding:"required"`
	CameraType string `json:"camera_type" binding:"required"`
	Location   string `json:"location" binding:"required"`
	Status     string `json:"status" binding:"required"`
}

type UpdateCameraRequest struct {
	CameraID   string `json:"camera_id" binding:"required"`
	Name       string `json:"name" binding:"required"`
	StreamURL  string `json:"stream_url" binding:"required"`
	CameraType string `json:"camera_type" binding:"required"`
	Location   string `json:"location" binding:"required"`
	Status     string `json:"status" binding:"required"`
}

type CameraResponse struct {
	ID         uint   `json:"id"`
	CameraID   string `json:"camera_id"`
	Name       string `json:"name"`
	StreamURL  string `json:"stream_url"`
	CameraType string `json:"camera_type"`
	Location   string `json:"location"`
	Status     string `json:"status"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}
