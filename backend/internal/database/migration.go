package database

import (
	"fmt"

	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/alert"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/auth"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/camera"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/event"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/evidence"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/zone"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := migrateCameras(db); err != nil {
		return fmt.Errorf("migrating cameras table: %w", err)
	}

	if err := db.AutoMigrate(
		&auth.User{},
		&camera.Camera{},
		&alert.Alert{},
		&zone.Zone{},
		&event.Event{},
		&evidence.Evidence{},
	); err != nil {
		return fmt.Errorf("database migration failed: %w", err)
	}

	return nil
}

func migrateCameras(db *gorm.DB) error {
	if !db.Migrator().HasTable(&camera.Camera{}) {
		return nil
	}

	if !db.Migrator().HasColumn(&camera.Camera{}, "external_id") {
		if err := db.Exec(`ALTER TABLE "cameras" ADD COLUMN "external_id" text`).Error; err != nil {
			return fmt.Errorf("adding external_id column: %w", err)
		}
	}

	if err := db.Exec(`UPDATE "cameras" SET "external_id" = CONCAT('CAM-', id) WHERE "external_id" IS NULL OR TRIM("external_id") = ''`).Error; err != nil {
		return fmt.Errorf("populating external_id: %w", err)
	}

	return nil
}

