package camera

import (
	"time"

	"gorm.io/gorm"
)

type Camera struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	Name       string         `gorm:"not null" json:"name"`
	ExternalID string         `gorm:"uniqueIndex;not null" json:"camera_id"`
	StreamURL  string         `gorm:"not null" json:"stream_url"`
	CameraType string         `gorm:"not null;default:ip_webcam" json:"camera_type"`
	Location   string         `gorm:"not null" json:"location"`
	Status     string         `gorm:"not null" json:"status"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}
