package camera

import "gorm.io/gorm"

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) Create(camera *Camera) error {
	return r.db.Create(camera).Error
}

func (r *Repository) FindAll() ([]Camera, error) {
	var cameras []Camera

	if err := r.db.Find(&cameras).Error; err != nil {
		return nil, err
	}

	return cameras, nil
}

func (r *Repository) FindByID(id uint) (*Camera, error) {
	var camera Camera

	if err := r.db.First(&camera, id).Error; err != nil {
		return nil, err
	}

	return &camera, nil
}

func (r *Repository) Update(camera *Camera) error {
	return r.db.Save(camera).Error
}

func (r *Repository) Delete(camera *Camera) error {
	return r.db.Delete(camera).Error
}
