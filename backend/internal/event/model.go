package event

import "time"

type Event struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CameraID  uint      `gorm:"not null;index" json:"camera_id"`
	Type      string    `gorm:"not null;index" json:"type"`
	Severity  string    `gorm:"not null;index" json:"severity"`
	Message   string    `gorm:"type:text" json:"message"`
	Timestamp time.Time `gorm:"not null;index" json:"timestamp"`
	CreatedAt time.Time `json:"created_at"`
}