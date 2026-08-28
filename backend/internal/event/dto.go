package event

import "time"

type EventResponse struct {
	ID        uint      `json:"id"`
	CameraID  uint      `json:"camera_id"`
	Type      string    `json:"type"`
	Severity  string    `json:"severity"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

type EventFilterRequest struct {
	CameraID uint   `form:"camera_id"`
	Date     string `form:"date"`
	Type     string `form:"type"`
	Severity string `form:"severity"`
}

type CreateEventRequest struct {
	CameraID  uint      `json:"camera_id" binding:"required"`
	Type      string    `json:"type" binding:"required"`
	Severity  string    `json:"severity" binding:"required"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp" binding:"required"`
}