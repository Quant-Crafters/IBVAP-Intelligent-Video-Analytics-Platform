package database_test

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/camera"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/database"
	"gorm.io/gorm"
)

type legacyCamera struct {
	ID         uint   `gorm:"primaryKey"`
	Name       string `gorm:"not null"`
	StreamURL  string `gorm:"not null"`
	CameraType string `gorm:"not null;default:ip_webcam"`
	Location   string `gorm:"not null"`
	Status     string `gorm:"not null"`
}

func (legacyCamera) TableName() string {
	return "cameras"
}

func TestMigrate_FreshDatabase(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite database: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		t.Fatalf("Migrate failed on fresh database: %v", err)
	}

	if !db.Migrator().HasTable("cameras") {
		t.Errorf("expected cameras table to exist")
	}

	if !db.Migrator().HasColumn("cameras", "external_id") {
		t.Errorf("expected external_id column to exist")
	}
}

func TestMigrate_ExistingTableWithRecords(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite database: %v", err)
	}

	// Create legacy cameras table without external_id column
	if err := db.AutoMigrate(&legacyCamera{}); err != nil {
		t.Fatalf("failed to auto migrate legacy cameras: %v", err)
	}

	// Insert legacy records
	legacyCameras := []legacyCamera{
		{ID: 1, Name: "Front Gate", StreamURL: "rtsp://gate", CameraType: "ip_webcam", Location: "Main Entrance", Status: "online"},
		{ID: 2, Name: "Back Entrance", StreamURL: "rtsp://back", CameraType: "ip_webcam", Location: "Rear", Status: "offline"},
	}

	for _, cam := range legacyCameras {
		if err := db.Create(&cam).Error; err != nil {
			t.Fatalf("failed to create legacy camera: %v", err)
		}
	}

	// Run migration
	if err := database.Migrate(db); err != nil {
		t.Fatalf("Migrate failed on existing database: %v", err)
	}

	// Verify existing records preserved and external_id populated
	var cameras []camera.Camera
	if err := db.Find(&cameras).Error; err != nil {
		t.Fatalf("failed to query migrated cameras: %v", err)
	}

	if len(cameras) != 2 {
		t.Fatalf("expected 2 cameras, got %d", len(cameras))
	}

	if cameras[0].ExternalID != "CAM-1" || cameras[0].Name != "Front Gate" {
		t.Errorf("unexpected data for camera 1: %+v", cameras[0])
	}

	if cameras[1].ExternalID != "CAM-2" || cameras[1].Name != "Back Entrance" {
		t.Errorf("unexpected data for camera 2: %+v", cameras[1])
	}

	// Test idempotency: re-running Migrate should succeed without error
	if err := database.Migrate(db); err != nil {
		t.Fatalf("Migrate failed on idempotent second run: %v", err)
	}
}
