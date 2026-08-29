package audit

import (
	"time"

	"gorm.io/gorm"
)

// Audit represents a security audit log entry.
type Audit struct {
	ID uint `gorm:"primaryKey"`

	UserID uint `gorm:"not null;index"`

	Action AuditAction `gorm:"type:varchar(32);not null;index"`

	Resource AuditResource `gorm:"type:varchar(32);not null;index"`

	ResourceID *uint `gorm:"index"`

	IPAddress string `gorm:"type:varchar(45)"`

	UserAgent string `gorm:"type:varchar(1024)"`

	Details string `gorm:"type:text"`

	Timestamp time.Time `gorm:"not null;index"`

	CreatedAt time.Time
	UpdatedAt time.Time

	DeletedAt gorm.DeletedAt `gorm:"index"`
}