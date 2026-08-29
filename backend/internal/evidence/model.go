package evidence

import (
	"time"

	"gorm.io/gorm"
)

// Evidence represents a stored piece of evidence associated
// with an alert or event.
type Evidence struct {
	ID uint `gorm:"primaryKey"`

	// Optional relationship to an alert.
	AlertID *uint `gorm:"index"`

	// Optional relationship to an event.
	EventID *uint `gorm:"index"`

	// Evidence type: image, video, or screenshot.
	Type EvidenceType `gorm:"type:varchar(20);not null;index"`

	// Storage location of the evidence file.
	FilePath string `gorm:"type:varchar(500);not null"`

	// Original/stored file name.
	FileName string `gorm:"type:varchar(255);not null"`

	// MIME type of the stored file.
	MimeType string `gorm:"type:varchar(100);not null"`

	// File size in bytes.
	FileSize int64 `gorm:"not null;default:0"`

	// Timestamp when the evidence was captured/generated.
	Timestamp time.Time `gorm:"not null;index"`

	// GORM timestamps.
	CreatedAt time.Time
	UpdatedAt time.Time

	// Soft delete support.
	DeletedAt gorm.DeletedAt `gorm:"index"`
}