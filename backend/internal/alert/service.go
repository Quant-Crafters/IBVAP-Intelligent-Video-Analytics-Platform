package alert

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

var (
	ErrAlertNotFound   = errors.New("alert not found")
	ErrInvalidSeverity = errors.New("invalid severity")
	ErrInvalidStatus   = errors.New("invalid alert status")
	ErrInvalidType     = errors.New("invalid alert type")
)

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

func (s *Service) Create(req CreateAlertRequest) (*AlertResponse, error) {
	alertType := strings.TrimSpace(strings.ToLower(req.Type))
	severity := strings.TrimSpace(strings.ToLower(req.Severity))
	status := strings.TrimSpace(strings.ToLower(req.Status))

	if req.CameraID == 0 || alertType == "" || severity == "" ||
		req.Timestamp == "" || status == "" {
		return nil, errors.New("required alert fields are missing")
	}

	if !isValidSeverity(severity) {
		return nil, ErrInvalidSeverity
	}

	if !isValidStatus(status) {
		return nil, ErrInvalidStatus
	}

	timestamp, err := time.Parse(time.RFC3339, req.Timestamp)
	if err != nil {
		return nil, fmt.Errorf("invalid timestamp: %w", err)
	}

	if req.Confidence < 0 || req.Confidence > 1 {
		return nil, errors.New("confidence must be between 0 and 1")
	}

	alert := &Alert{
		CameraID:   req.CameraID,
		Type:       alertType,
		Severity:   severity,
		Confidence: req.Confidence,
		Timestamp:  timestamp,
		Status:     status,
		Evidence:   strings.TrimSpace(req.Evidence),
	}

	if err := s.repository.Create(alert); err != nil {
		return nil, fmt.Errorf("creating alert: %w", err)
	}

	return toAlertResponse(alert), nil
}

func (s *Service) GetAll() ([]AlertResponse, error) {
	alerts, err := s.repository.FindAll()
	if err != nil {
		return nil, fmt.Errorf("fetching alerts: %w", err)
	}

	responses := make([]AlertResponse, 0, len(alerts))

	for i := range alerts {
		responses = append(responses, *toAlertResponse(&alerts[i]))
	}

	return responses, nil
}

func (s *Service) GetByID(id uint) (*AlertResponse, error) {
	alert, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAlertNotFound
		}

		return nil, fmt.Errorf("fetching alert: %w", err)
	}

	return toAlertResponse(alert), nil
}

func (s *Service) Update(id uint, req UpdateAlertRequest) (*AlertResponse, error) {
	alert, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAlertNotFound
		}

		return nil, fmt.Errorf("fetching alert: %w", err)
	}

	if req.Type != "" {
		alert.Type = strings.TrimSpace(strings.ToLower(req.Type))
	}

	if req.Severity != "" {
		severity := strings.TrimSpace(strings.ToLower(req.Severity))

		if !isValidSeverity(severity) {
			return nil, ErrInvalidSeverity
		}

		alert.Severity = severity
	}

	if req.Confidence != 0 {
		if req.Confidence < 0 || req.Confidence > 1 {
			return nil, errors.New("confidence must be between 0 and 1")
		}

		alert.Confidence = req.Confidence
	}

	if req.Status != "" {
		status := strings.TrimSpace(strings.ToLower(req.Status))

		if !isValidStatus(status) {
			return nil, ErrInvalidStatus
		}

		alert.Status = status
	}

	if req.Evidence != "" {
		alert.Evidence = strings.TrimSpace(req.Evidence)
	}

	if err := s.repository.Update(alert); err != nil {
		return nil, fmt.Errorf("updating alert: %w", err)
	}

	return toAlertResponse(alert), nil
}

func (s *Service) Delete(id uint) error {
	alert, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrAlertNotFound
		}

		return fmt.Errorf("fetching alert: %w", err)
	}

	if err := s.repository.Delete(alert.ID); err != nil {
		return fmt.Errorf("deleting alert: %w", err)
	}

	return nil
}

// Acknowledge marks an alert as acknowledged.
// This action is used by Security Sentry.
func (s *Service) Acknowledge(id uint) (*AlertResponse, error) {
	return s.updateStatus(id, "acknowledged")
}

// Escalate marks an alert as escalated.
// This action is used by Post Commander.
func (s *Service) Escalate(id uint) (*AlertResponse, error) {
	return s.updateStatus(id, "escalated")
}

// MarkFalseAlert marks an alert as a false alert.
// This action is used by Post Commander.
func (s *Service) MarkFalseAlert(id uint) (*AlertResponse, error) {
	return s.updateStatus(id, "false_alert")
}

func (s *Service) updateStatus(id uint, status string) (*AlertResponse, error) {
	alert, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAlertNotFound
		}

		return nil, fmt.Errorf("fetching alert: %w", err)
	}

	alert.Status = status

	if err := s.repository.Update(alert); err != nil {
		return nil, fmt.Errorf("updating alert status: %w", err)
	}

	return toAlertResponse(alert), nil
}

func toAlertResponse(alert *Alert) *AlertResponse {
	return &AlertResponse{
		ID:         alert.ID,
		CameraID:   alert.CameraID,
		Type:       alert.Type,
		Severity:   alert.Severity,
		Confidence: alert.Confidence,
		Timestamp:  alert.Timestamp.UTC().Format(time.RFC3339),
		Status:     alert.Status,
		Evidence:   alert.Evidence,
	}
}

func isValidSeverity(severity string) bool {
	switch severity {
	case "low", "medium", "high", "critical":
		return true
	default:
		return false
	}
}

func isValidStatus(status string) bool {
	switch status {
	case "new", "acknowledged", "escalated", "false_alert", "resolved":
		return true
	default:
		return false
	}
}
