package alert

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

var (
	ErrAlertNotFound     = errors.New("alert not found")
	ErrInvalidSeverity   = errors.New("invalid severity")
	ErrInvalidStatus     = errors.New("invalid alert status")
	ErrInvalidType       = errors.New("invalid alert type")
	ErrInvalidTimestamp  = errors.New("invalid timestamp")
	ErrInvalidConfidence = errors.New("confidence must be between 0 and 1")
)

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

// Create creates a new alert after validating the request.
func (s *Service) Create(req CreateAlertRequest) (*AlertResponse, error) {
	alertType := strings.TrimSpace(strings.ToLower(req.Type))
	severity := strings.TrimSpace(strings.ToLower(req.Severity))
	status := strings.TrimSpace(strings.ToLower(req.Status))

	// Validate required fields.
	if req.CameraID == 0 {
		return nil, errors.New("camera_id is required")
	}

	if alertType == "" {
		return nil, errors.New("alert type is required")
	}

	if severity == "" {
		return nil, errors.New("severity is required")
	}

	if status == "" {
		return nil, errors.New("status is required")
	}

	if req.Timestamp == "" {
		return nil, errors.New("timestamp is required")
	}

	// Validate alert type.
	if !isValidType(alertType) {
		return nil, ErrInvalidType
	}

	// Validate severity.
	if !isValidSeverity(severity) {
		return nil, ErrInvalidSeverity
	}

	// Validate status.
	if !isValidStatus(status) {
		return nil, ErrInvalidStatus
	}

	// Validate timestamp.
	timestamp, err := time.Parse(time.RFC3339, req.Timestamp)
	if err != nil {
		return nil, fmt.Errorf("%w: timestamp must be RFC3339", ErrInvalidTimestamp)
	}

	// Validate confidence.
	if req.Confidence < 0 || req.Confidence > 1 {
		return nil, ErrInvalidConfidence
	}

	alert := &Alert{
		CameraID:   req.CameraID,
		Type:       alertType,
		Severity:   severity,
		Confidence: req.Confidence,
		Timestamp:  timestamp.UTC(),
		Status:     status,
		Evidence:   strings.TrimSpace(req.Evidence),
	}

	if err := s.repository.Create(alert); err != nil {
		return nil, fmt.Errorf("creating alert: %w", err)
	}

	return toAlertResponse(alert), nil
}

// GetAll returns all alerts.
func (s *Service) GetAll() ([]AlertResponse, error) {
	alerts, err := s.repository.FindAll()
	if err != nil {
		return nil, fmt.Errorf("fetching alerts: %w", err)
	}

	responses := make([]AlertResponse, 0, len(alerts))

	for i := range alerts {
		response := toAlertResponse(&alerts[i])

		if response != nil {
			responses = append(responses, *response)
		}
	}

	return responses, nil
}

// GetByID returns an alert by ID.
func (s *Service) GetByID(id uint) (*AlertResponse, error) {
	if id == 0 {
		return nil, ErrAlertNotFound
	}

	alert, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAlertNotFound
		}

		return nil, fmt.Errorf("fetching alert: %w", err)
	}

	return toAlertResponse(alert), nil
}

// Update updates an existing alert.
func (s *Service) Update(
	id uint,
	req UpdateAlertRequest,
) (*AlertResponse, error) {

	if id == 0 {
		return nil, ErrAlertNotFound
	}

	alert, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAlertNotFound
		}

		return nil, fmt.Errorf("fetching alert: %w", err)
	}

	// Update type.
	if req.Type != "" {
		alertType := strings.TrimSpace(strings.ToLower(req.Type))

		if !isValidType(alertType) {
			return nil, ErrInvalidType
		}

		alert.Type = alertType
	}

	// Update severity.
	if req.Severity != "" {
		severity := strings.TrimSpace(strings.ToLower(req.Severity))

		if !isValidSeverity(severity) {
			return nil, ErrInvalidSeverity
		}

		alert.Severity = severity
	}

	// Update confidence.
	//
	// Because Confidence is *float64, we can distinguish:
	//
	// nil  -> confidence was not provided
	// 0    -> explicitly set confidence to 0
	// 0.8  -> explicitly set confidence to 0.8
	if req.Confidence != nil {
		if *req.Confidence < 0 || *req.Confidence > 1 {
			return nil, ErrInvalidConfidence
		}

		alert.Confidence = *req.Confidence
	}

	// Update status.
	if req.Status != "" {
		status := strings.TrimSpace(strings.ToLower(req.Status))

		if !isValidStatus(status) {
			return nil, ErrInvalidStatus
		}

		alert.Status = status
	}

	// Update evidence.
	if req.Evidence != "" {
		alert.Evidence = strings.TrimSpace(req.Evidence)
	}

	if err := s.repository.Update(alert); err != nil {
		return nil, fmt.Errorf("updating alert: %w", err)
	}

	return toAlertResponse(alert), nil
}

// Delete permanently deletes an alert.
func (s *Service) Delete(id uint) error {
	if id == 0 {
		return ErrAlertNotFound
	}

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
func (s *Service) Acknowledge(id uint) (*AlertResponse, error) {
	return s.updateStatus(id, "acknowledged")
}

// Escalate marks an alert as escalated.
func (s *Service) Escalate(id uint) (*AlertResponse, error) {
	return s.updateStatus(id, "escalated")
}

// MarkFalseAlert marks an alert as a false alert.
func (s *Service) MarkFalseAlert(id uint) (*AlertResponse, error) {
	return s.updateStatus(id, "false_alert")
}

// updateStatus updates an alert's status.
func (s *Service) updateStatus(
	id uint,
	status string,
) (*AlertResponse, error) {

	if id == 0 {
		return nil, ErrAlertNotFound
	}

	if !isValidStatus(status) {
		return nil, ErrInvalidStatus
	}

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

// toAlertResponse converts the database model to the API response.
func toAlertResponse(alert *Alert) *AlertResponse {
	if alert == nil {
		return nil
	}

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

// isValidType validates the alert type.
//
// We only require a non-empty type here because the actual
// supported detection types should come from the AI engine.
func isValidType(alertType string) bool {
	return strings.TrimSpace(alertType) != ""
}

// isValidSeverity validates alert severity.
func isValidSeverity(severity string) bool {
	switch severity {
	case "low", "medium", "high", "critical":
		return true
	default:
		return false
	}
}

// isValidStatus validates alert status.
func isValidStatus(status string) bool {
	switch status {
	case "new",
		"acknowledged",
		"escalated",
		"false_alert",
		"resolved":
		return true
	default:
		return false
	}
}