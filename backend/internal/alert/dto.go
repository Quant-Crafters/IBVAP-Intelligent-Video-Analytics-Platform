package alert

type CreateAlertRequest struct {
	CameraID   uint    `json:"camera_id" binding:"required"`
	Type       string  `json:"type" binding:"required,min=2,max=50"`
	Severity   string  `json:"severity" binding:"required,oneof=low medium high critical"`
	Confidence float64 `json:"confidence" binding:"gte=0,lte=1"`
	Timestamp  string  `json:"timestamp" binding:"required"`
	Status     string  `json:"status" binding:"required,oneof=active acknowledged escalated false_alert resolved"`
	Evidence   string  `json:"evidence,omitempty"`
}

type UpdateAlertRequest struct {
	Type       string  `json:"type,omitempty" binding:"omitempty,min=2,max=50"`
	Severity   string  `json:"severity,omitempty" binding:"omitempty,oneof=low medium high critical"`
	Confidence *float64 `json:"confidence,omitempty" binding:"omitempty,gte=0,lte=1"`
	Status     string  `json:"status,omitempty" binding:"omitempty,oneof=active acknowledged escalated false_alert resolved"`
	Evidence   string  `json:"evidence,omitempty"`
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