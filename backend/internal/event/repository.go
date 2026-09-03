package event

import (
	"time"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) FindAll(filters EventFilterRequest) ([]Event, error) {
	var events []Event

	query := r.db.Model(&Event{})

	// Filter by camera
	if filters.CameraID != 0 {
		query = query.Where("camera_id = ?", filters.CameraID)
	}

	// Filter by date
	if filters.Date != "" {
		date, err := time.Parse("2006-01-02", filters.Date)
		if err != nil {
			return nil, err
		}

		nextDate := date.AddDate(0, 0, 1)

		query = query.Where(
			"timestamp >= ? AND timestamp < ?",
			date,
			nextDate,
		)
	}

	// Filter by event type
	if filters.Type != "" {
		query = query.Where("type = ?", filters.Type)
	}

	// Filter by severity
	if filters.Severity != "" {
		query = query.Where("severity = ?", filters.Severity)
	}

	// Latest events first
	query = query.Order("timestamp DESC")

	if err := query.Find(&events).Error; err != nil {
		return nil, err
	}

	return events, nil
}

func (r *Repository) FindByID(id uint) (*Event, error) {
	var event Event

	if err := r.db.First(&event, id).Error; err != nil {
		return nil, err
	}

	return &event, nil
}


func (r *Repository) Create(event *Event) error {
	return r.db.Create(event).Error
}

func (r *Repository) ClearAll() (int64, error) {
	result := r.db.Exec("DELETE FROM events")
	return result.RowsAffected, result.Error
}