package zone

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

var (
	ErrZoneNotFound       = errors.New("zone not found")
	ErrInvalidZoneType    = errors.New("invalid zone type")
	ErrInvalidCoordinates = errors.New("invalid coordinates")
	ErrInvalidZoneName    = errors.New("zone name cannot be empty")
)

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

func (s *Service) Create(req CreateZoneRequest) (*ZoneResponse, error) {
	name := strings.TrimSpace(req.Name)
	zoneType := strings.TrimSpace(strings.ToLower(req.Type))

	if req.CameraID == 0 || name == "" || zoneType == "" {
		return nil, errors.New("required zone fields are missing")
	}

	if !isValidZoneType(zoneType) {
		return nil, ErrInvalidZoneType
	}

	if !isValidCoordinates(zoneType, req.Coordinates) {
		return nil, ErrInvalidCoordinates
	}

	zone := &Zone{
		CameraID:    req.CameraID,
		Name:        name,
		Type:        zoneType,
		Coordinates: req.Coordinates,
	}

	if err := s.repository.Create(zone); err != nil {
		return nil, fmt.Errorf("creating zone: %w", err)
	}

	return toZoneResponse(zone), nil
}

func (s *Service) GetAll() ([]ZoneResponse, error) {
	zones, err := s.repository.FindAll()
	if err != nil {
		return nil, fmt.Errorf("fetching zones: %w", err)
	}

	responses := make([]ZoneResponse, 0, len(zones))

	for i := range zones {
		responses = append(responses, *toZoneResponse(&zones[i]))
	}

	return responses, nil
}

func (s *Service) GetByID(id uint) (*ZoneResponse, error) {
	zone, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrZoneNotFound
		}

		return nil, fmt.Errorf("fetching zone: %w", err)
	}

	return toZoneResponse(zone), nil
}

func (s *Service) Update(id uint, req UpdateZoneRequest) (*ZoneResponse, error) {
	zone, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrZoneNotFound
		}

		return nil, fmt.Errorf("fetching zone: %w", err)
	}

	if req.Name != "" {
		name := strings.TrimSpace(req.Name)

		if name == "" {
			return nil, ErrInvalidZoneName
		}

		zone.Name = name
	}

	if req.Type != "" {
		zoneType := strings.TrimSpace(strings.ToLower(req.Type))

		if !isValidZoneType(zoneType) {
			return nil, ErrInvalidZoneType
		}

		if req.Coordinates != nil && !isValidCoordinates(zoneType, req.Coordinates) {
			return nil, ErrInvalidCoordinates
		}

		zone.Type = zoneType
	}

	if req.Coordinates != nil {
		if !isValidCoordinates(zone.Type, req.Coordinates) {
			return nil, ErrInvalidCoordinates
		}

		zone.Coordinates = req.Coordinates
	}

	if err := s.repository.Update(zone); err != nil {
		return nil, fmt.Errorf("updating zone: %w", err)
	}

	return toZoneResponse(zone), nil
}

func (s *Service) Delete(id uint) error {
	zone, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrZoneNotFound
		}

		return fmt.Errorf("fetching zone: %w", err)
	}

	if err := s.repository.Delete(zone.ID); err != nil {
		return fmt.Errorf("deleting zone: %w", err)
	}

	return nil
}

func isValidZoneType(zoneType string) bool {
	switch zoneType {
	case "line", "polygon", "restricted_zone":
		return true
	default:
		return false
	}
}

func isValidCoordinates(zoneType string, coordinates []Coordinate) bool {
	switch zoneType {
	case "line":
		return len(coordinates) == 2
	case "polygon", "restricted_zone":
		return len(coordinates) >= 3
	default:
		return false
	}
}

func toZoneResponse(zone *Zone) *ZoneResponse {
	return &ZoneResponse{
		ID:          zone.ID,
		CameraID:    zone.CameraID,
		Name:        zone.Name,
		Type:        zone.Type,
		Coordinates: zone.Coordinates,
	}
}