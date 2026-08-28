package alert

import (
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

func (r *Repository) Create(alert *Alert) error {
	return r.db.Create(alert).Error
}

func (r *Repository) FindAll() ([]Alert, error) {
	var alerts []Alert

	err := r.db.
		Order("timestamp DESC").
		Find(&alerts).Error

	return alerts, err
}

func (r *Repository) FindByID(id uint) (*Alert, error) {
	var alert Alert

	if err := r.db.First(&alert, id).Error; err != nil {
		return nil, err
	}

	return &alert, nil
}

func (r *Repository) Update(alert *Alert) error {
	return r.db.Save(alert).Error
}

func (r *Repository) Delete(id uint) error {
	return r.db.Delete(&Alert{}, id).Error
}
