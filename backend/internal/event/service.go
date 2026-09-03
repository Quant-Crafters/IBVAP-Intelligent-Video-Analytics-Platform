package event

import (
	"errors"
	"fmt"
	"strings"

	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/alert"
	"gorm.io/gorm"
)

var ErrEventNotFound = errors.New("event not found")

type Service struct {
	repository *Repository
	alertRepo  *alert.Repository
}

func NewService(repository *Repository, alertRepo *alert.Repository) *Service {
	return &Service{
		repository: repository,
		alertRepo:  alertRepo,
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

	if s.alertRepo != nil {
		sev := strings.ToLower(req.Severity)
		if sev == "" {
			sev = strings.ToLower(req.ThreatLevel)
		}
		if sev == "" || (sev != "low" && sev != "medium" && sev != "high" && sev != "critical") {
			sev = "medium"
		}
		conf := float64(req.ThreatScore)
		if conf == 0 && req.Confidence > 0 {
			conf = req.Confidence
		}
		evidence := req.EvidenceImage
		if evidence == "" {
			evidence = req.IncidentClip
		}
		newAlert := &alert.Alert{
			CameraID:   req.CameraID,
			Type:       req.Type,
			Severity:   sev,
			Confidence: conf,
			Timestamp:  req.Timestamp,
			Status:     "active",
			Evidence:   evidence,
		}
		_ = s.alertRepo.Create(newAlert)
	}

	return toEventResponse(event), nil
}

func (s *Service) ClearAll() (int64, int64, error) {
	eventsCleared, err := s.repository.ClearAll()
	if err != nil {
		return 0, 0, err
	}
	var alertsCleared int64
	if s.alertRepo != nil {
		alertsCleared, _ = s.alertRepo.ClearAll()
	}
	return eventsCleared, alertsCleared, nil
}