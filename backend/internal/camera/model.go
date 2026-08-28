package camera

import (
	"time"

	"gorm.io/gorm"
)

type Camera struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"not null" json:"name"`
	StreamURL string         `gorm:"not null" json:"stream_url"`
	Location  string         `gorm:"not null" json:"location"`
	Status    string         `gorm:"not null" json:"status"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
