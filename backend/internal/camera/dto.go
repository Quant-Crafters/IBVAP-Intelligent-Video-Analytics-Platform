package camera

type CreateCameraRequest struct {
	Name      string `json:"name" binding:"required"`
	StreamURL string `json:"stream_url" binding:"required"`
	Location  string `json:"location" binding:"required"`
	Status    string `json:"status" binding:"required"`
}

type UpdateCameraRequest struct {
	Name      string `json:"name" binding:"required"`
	StreamURL string `json:"stream_url" binding:"required"`
	Location  string `json:"location" binding:"required"`
	Status    string `json:"status" binding:"required"`
}

type CameraResponse struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	StreamURL string `json:"stream_url"`
	Location  string `json:"location"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}
