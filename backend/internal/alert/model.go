package alert

import (
	"time"

	"gorm.io/gorm"
)

type Alert struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	CameraID   uint           `gorm:"not null;index" json:"camera_id"`
	Type       string         `gorm:"not null" json:"type"`
	Severity   string         `gorm:"not null" json:"severity"`
	Confidence float64        `gorm:"not null" json:"confidence"`
	Timestamp  time.Time      `gorm:"not null;index" json:"timestamp"`
	Status     string         `gorm:"not null" json:"status"`
	Evidence   string         `json:"evidence"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}
