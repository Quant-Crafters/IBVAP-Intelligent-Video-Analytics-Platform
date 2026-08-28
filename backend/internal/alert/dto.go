package alert

type CreateAlertRequest struct {
	CameraID   uint    `json:"camera_id" binding:"required"`
	Type       string  `json:"type" binding:"required"`
	Severity   string  `json:"severity" binding:"required"`
	Confidence float64 `json:"confidence" binding:"required"`
	Timestamp  string  `json:"timestamp" binding:"required"`
	Status     string  `json:"status" binding:"required"`
	Evidence   string  `json:"evidence"`
}

type UpdateAlertRequest struct {
	Type       string  `json:"type"`
	Severity   string  `json:"severity"`
	Confidence float64 `json:"confidence"`
	Status     string  `json:"status"`
	Evidence   string  `json:"evidence"`
}

type AlertResponse struct {
	ID         uint    `json:"id"`
	CameraID   uint    `json:"camera_id"`
	Type       string  `json:"type"`
	Severity   string  `json:"severity"`
	Confidence float64 `json:"confidence"`
	Timestamp  string  `json:"timestamp"`
	Status     string  `json:"status"`
	Evidence   string  `json:"evidence"`
}
