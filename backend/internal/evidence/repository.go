package evidence

import (
	"errors"

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

// Create inserts a new evidence record into the database.
func (r *Repository) Create(evidence *Evidence) error {
	if r.db == nil {
		return errors.New("database connection is not initialized")
	}

	if evidence == nil {
		return errors.New("evidence record cannot be nil")
	}

	if err := r.db.Create(evidence).Error; err != nil {
		return err
	}

	return nil
}

// FindAll returns filtered and paginated evidence records.
func (r *Repository) FindAll(filters EvidenceFilterRequest) ([]Evidence, error) {
	if r.db == nil {
		return nil, errors.New("database connection is not initialized")
	}

	var evidence []Evidence

	query := r.db.Model(&Evidence{})

	// Filter by alert ID.
	if filters.AlertID != nil {
		query = query.Where("alert_id = ?", *filters.AlertID)
	}

	// Filter by event ID.
	if filters.EventID != nil {
		query = query.Where("event_id = ?", *filters.EventID)
	}

	// Filter by evidence type.
	if filters.Type != nil {
		query = query.Where("type = ?", *filters.Type)
	}

	// Newest evidence first.
	query = query.Order("created_at DESC")

	// Safe pagination defaults.
	page := filters.Page
	if page < 1 {
		page = 1
	}

	pageSize := filters.PageSize
	if pageSize < 1 {
		pageSize = 50
	}

	if pageSize > 100 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize

	query = query.Offset(offset).Limit(pageSize)

	if err := query.Find(&evidence).Error; err != nil {
		return nil, err
	}

	return evidence, nil
}

// FindByID returns a single evidence record by ID.
func (r *Repository) FindByID(id uint) (*Evidence, error) {
	if r.db == nil {
		return nil, errors.New("database connection is not initialized")
	}

	if id == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	var evidence Evidence

	if err := r.db.First(&evidence, id).Error; err != nil {
		return nil, err
	}

	return &evidence, nil
}

// Update updates an existing evidence record.
func (r *Repository) Update(evidence *Evidence) error {
	if r.db == nil {
		return errors.New("database connection is not initialized")
	}

	if evidence == nil {
		return errors.New("evidence record cannot be nil")
	}

	if evidence.ID == 0 {
		return errors.New("evidence record id cannot be zero")
	}

	result := r.db.Model(&Evidence{}).
		Where("id = ?", evidence.ID).
		Updates(map[string]interface{}{
			"file_name": evidence.FileName,
			"mime_type": evidence.MimeType,
		})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}

	return nil
}

// Delete removes an evidence record by ID.
//
// Because Evidence contains gorm.DeletedAt, this performs
// a soft delete instead of permanently removing the record.
func (r *Repository) Delete(id uint) error {
	if r.db == nil {
		return errors.New("database connection is not initialized")
	}

	if id == 0 {
		return gorm.ErrRecordNotFound
	}

	result := r.db.Delete(&Evidence{}, id)

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}

	return nil
}

// Count returns the total number of evidence records
// matching the supplied filters.
func (r *Repository) Count(filters EvidenceFilterRequest) (int64, error) {
	if r.db == nil {
		return 0, errors.New("database connection is not initialized")
	}

	var total int64

	query := r.db.Model(&Evidence{})

	if filters.AlertID != nil {
		query = query.Where("alert_id = ?", *filters.AlertID)
	}

	if filters.EventID != nil {
		query = query.Where("event_id = ?", *filters.EventID)
	}

	if filters.Type != nil {
		query = query.Where("type = ?", *filters.Type)
	}

	if err := query.Count(&total).Error; err != nil {
		return 0, err
	}

	return total, nil
}