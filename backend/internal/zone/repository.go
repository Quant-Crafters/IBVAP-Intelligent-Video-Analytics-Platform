package zone

import "gorm.io/gorm"

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) Create(zone *Zone) error {
	return r.db.Create(zone).Error
}

func (r *Repository) FindAll() ([]Zone, error) {
	var zones []Zone

	err := r.db.
		Order("created_at DESC").
		Find(&zones).Error

	return zones, err
}

func (r *Repository) FindByID(id uint) (*Zone, error) {
	var zone Zone

	if err := r.db.First(&zone, id).Error; err != nil {
		return nil, err
	}

	return &zone, nil
}

func (r *Repository) Update(zone *Zone) error {
	return r.db.Save(zone).Error
}

func (r *Repository) Delete(id uint) error {
	return r.db.Delete(&Zone{}, id).Error
}