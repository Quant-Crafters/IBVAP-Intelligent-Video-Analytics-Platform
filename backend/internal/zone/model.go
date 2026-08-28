package zone

import "time"

type Coordinate struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Zone struct {
	ID          uint         `gorm:"primaryKey" json:"id"`
	CameraID    uint         `gorm:"not null;index" json:"camera_id"`
	Name        string       `gorm:"not null" json:"name"`
	Type        string       `gorm:"not null;index" json:"type"`
	Coordinates []Coordinate `gorm:"serializer:json;not null" json:"coordinates"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}