package event

import (
	"errors"
	"fmt"

	"gorm.io/gorm"
)

var ErrEventNotFound = errors.New("event not found")

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

// GetAll returns all events with optional filters.
func (s *Service) GetAll(filters EventFilterRequest) ([]EventResponse, error) {
	events, err := s.repository.FindAll(filters)
	if err != nil {
		return nil, fmt.Errorf("fetching events: %w", err)
	}

	responses := make([]EventResponse, 0, len(events))

	for i := range events {
		response := toEventResponse(&events[i])
		responses = append(responses, *response)
	}

	return responses, nil
}

// GetByID returns a single event by ID.
func (s *Service) GetByID(id uint) (*EventResponse, error) {
	event, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEventNotFound
		}

		return nil, fmt.Errorf("fetching event: %w", err)
	}

	return toEventResponse(event), nil
}

// Converts database Event model into API response.
func toEventResponse(event *Event) *EventResponse {
	return &EventResponse{
		ID:        event.ID,
		CameraID:  event.CameraID,
		Type:      event.Type,
		Severity:  event.Severity,
		Message:   event.Message,
		Timestamp: event.Timestamp,

		ExternalEventID: event.ExternalEventID,
		Confidence:      event.Confidence,

		PersonID:  event.PersonID,
		VehicleID: event.VehicleID,

		ZoneStatus: event.ZoneStatus,

		ObjectName:    event.ObjectName,
		CarriedObject: event.CarriedObject,

		VehiclePresent: event.VehiclePresent,
		VehicleType:    event.VehicleType,

		PlateNumber:     event.PlateNumber,
		PlateCountry:    event.PlateCountry,
		PlateConfidence: event.PlateConfidence,

		ThreatScore: event.ThreatScore,
		ThreatLevel: event.ThreatLevel,

		EvidenceImage: event.EvidenceImage,
		IncidentClip:  event.IncidentClip,
	}
}

// Create creates and stores a new event.
func (s *Service) Create(req CreateEventRequest) (*EventResponse, error) {
	event := &Event{
		CameraID:  req.CameraID,
		Type:      req.Type,
		Severity:  req.Severity,
		Message:   req.Message,
		Timestamp: req.Timestamp,

		ExternalEventID: req.ExternalEventID,
		Confidence:      req.Confidence,

		PersonID:  req.PersonID,
		VehicleID: req.VehicleID,

		ZoneStatus: req.ZoneStatus,

		ObjectName:    req.ObjectName,
		CarriedObject: req.CarriedObject,

		VehiclePresent: req.VehiclePresent,
		VehicleType:    req.VehicleType,

		PlateNumber:     req.PlateNumber,
		PlateCountry:    req.PlateCountry,
		PlateConfidence: req.PlateConfidence,

		ThreatScore: req.ThreatScore,
		ThreatLevel: req.ThreatLevel,

		EvidenceImage: req.EvidenceImage,
		IncidentClip:  req.IncidentClip,
	}

	if err := s.repository.Create(event); err != nil {
		return nil, fmt.Errorf("creating event: %w", err)
	}

	return toEventResponse(event), nil
}