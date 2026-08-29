package audit

import (
	"errors"
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

// Create inserts a new audit record into the database.
func (r *Repository) Create(audit *Audit) error {
	if r.db == nil {
		return errors.New("database connection is not initialized")
	}

	if audit == nil {
		return errors.New("audit record cannot be nil")
	}

	if err := r.db.Create(audit).Error; err != nil {
		return err
	}

	return nil
}

// FindAll returns filtered and paginated audit records.
func (r *Repository) FindAll(filters AuditFilterRequest) ([]Audit, error) {
	if r.db == nil {
		return nil, errors.New("database connection is not initialized")
	}

	var audits []Audit

	query := r.db.Model(&Audit{})

	if filters.UserID != nil {
		query = query.Where("user_id = ?", *filters.UserID)
	}

	if filters.Action != nil {
		query = query.Where("action = ?", *filters.Action)
	}

	if filters.Resource != nil {
		query = query.Where("resource = ?", *filters.Resource)
	}

	if filters.ResourceID != nil {
		query = query.Where("resource_id = ?", *filters.ResourceID)
	}

	if filters.IPAddress != "" {
		query = query.Where("ip_address = ?", filters.IPAddress)
	}

	if filters.From != nil {
		query = query.Where("timestamp >= ?", filters.From.UTC())
	}

	if filters.To != nil {
		query = query.Where("timestamp <= ?", filters.To.UTC())
	}

	// Newest audit records first.
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

	if err := query.Find(&audits).Error; err != nil {
		return nil, err
	}

	return audits, nil
}

// FindByID returns a single audit record by ID.
func (r *Repository) FindByID(id uint) (*Audit, error) {
	if r.db == nil {
		return nil, errors.New("database connection is not initialized")
	}

	if id == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	var audit Audit

	if err := r.db.First(&audit, id).Error; err != nil {
		return nil, err
	}

	return &audit, nil
}

// Update updates an existing audit record.
func (r *Repository) Update(audit *Audit) error {
	if r.db == nil {
		return errors.New("database connection is not initialized")
	}

	if audit == nil {
		return errors.New("audit record cannot be nil")
	}

	if audit.ID == 0 {
		return errors.New("audit record id cannot be zero")
	}

	if err := r.db.Save(audit).Error; err != nil {
		return err
	}

	return nil
}

// Delete removes an audit record by ID.
func (r *Repository) Delete(id uint) error {
	if r.db == nil {
		return errors.New("database connection is not initialized")
	}

	if id == 0 {
		return gorm.ErrRecordNotFound
	}

	result := r.db.Delete(&Audit{}, id)

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}

	return nil
}

// Count returns the total number of audit records matching the filters.
func (r *Repository) Count(filters AuditFilterRequest) (int64, error) {
	if r.db == nil {
		return 0, errors.New("database connection is not initialized")
	}

	var total int64

	query := r.db.Model(&Audit{})

	if filters.UserID != nil {
		query = query.Where("user_id = ?", *filters.UserID)
	}

	if filters.Action != nil {
		query = query.Where("action = ?", *filters.Action)
	}

	if filters.Resource != nil {
		query = query.Where("resource = ?", *filters.Resource)
	}

	if filters.ResourceID != nil {
		query = query.Where("resource_id = ?", *filters.ResourceID)
	}

	if filters.IPAddress != "" {
		query = query.Where("ip_address = ?", filters.IPAddress)
	}

	if filters.From != nil {
		query = query.Where("timestamp >= ?", filters.From.UTC())
	}

	if filters.To != nil {
		query = query.Where("timestamp <= ?", filters.To.UTC())
	}

	if err := query.Count(&total).Error; err != nil {
		return 0, err
	}

	return total, nil
}

// DeleteOlderThan removes audit records older than the specified time.
//
// Use this only when the application's audit-retention policy allows
// permanent deletion of historical audit records.
func (r *Repository) DeleteOlderThan(before time.Time) error {
	if r.db == nil {
		return errors.New("database connection is not initialized")
	}

	result := r.db.
		Where("created_at < ?", before.UTC()).
		Delete(&Audit{})

	if result.Error != nil {
		return result.Error
	}

	return nil
}