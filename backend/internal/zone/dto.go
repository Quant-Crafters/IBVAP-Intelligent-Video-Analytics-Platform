package zone

type CreateZoneRequest struct {
	CameraID    uint         `json:"camera_id" binding:"required"`
	Name        string       `json:"name" binding:"required"`
	Type        string       `json:"type" binding:"required"`
	Coordinates []Coordinate `json:"coordinates" binding:"required"`
}

type UpdateZoneRequest struct {
	Name        string       `json:"name"`
	Type        string       `json:"type"`
	Coordinates []Coordinate `json:"coordinates"`
}

type ZoneResponse struct {
	ID          uint         `json:"id"`
	CameraID    uint         `json:"camera_id"`
	Name        string       `json:"name"`
	Type        string       `json:"type"`
	Coordinates []Coordinate `json:"coordinates"`
}