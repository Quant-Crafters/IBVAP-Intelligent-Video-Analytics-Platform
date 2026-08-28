package database

import (
	"fmt"

	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/alert"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/auth"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/camera"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/event"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/zone"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&auth.User{},
		&camera.Camera{},
		&alert.Alert{},
		&zone.Zone{},
		&event.Event{},
	); err != nil {
		return fmt.Errorf("database migration failed: %w", err)
	}

	return nil
}
