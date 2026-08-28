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
	}

	if err := s.repository.Create(event); err != nil {
		return nil, fmt.Errorf("creating event: %w", err)
	}

	return toEventResponse(event), nil
}