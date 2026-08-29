package audit

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

var (
	ErrAuditNotFound   = errors.New("audit record not found")
	ErrInvalidAction   = errors.New("invalid audit action")
	ErrInvalidResource = errors.New("invalid audit resource")
)

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

// Create creates a new audit log entry.
func (s *Service) Create(req CreateAuditRequest) (*AuditResponse, error) {
	if s.repository == nil {
		return nil, errors.New("audit repository is not initialized")
	}

	if req.UserID == 0 {
		return nil, errors.New("user id is required")
	}

	// Normalize enum values.
	req.Action = AuditAction(
		strings.ToLower(strings.TrimSpace(string(req.Action))),
	)

	req.Resource = AuditResource(
		strings.ToLower(strings.TrimSpace(string(req.Resource))),
	)

	if !isValidAction(req.Action) {
		return nil, ErrInvalidAction
	}

	if !isValidResource(req.Resource) {
		return nil, ErrInvalidResource
	}

	if req.Timestamp.IsZero() {
		return nil, errors.New("timestamp is required")
	}

	audit := &Audit{
		UserID:     req.UserID,
		Action:     req.Action,
		Resource:   req.Resource,
		ResourceID: req.ResourceID,
		IPAddress:  strings.TrimSpace(req.IPAddress),
		UserAgent:  strings.TrimSpace(req.UserAgent),
		Details:    strings.TrimSpace(req.Details),
		Timestamp:  req.Timestamp.UTC(),
	}

	if err := s.repository.Create(audit); err != nil {
		return nil, fmt.Errorf("creating audit record: %w", err)
	}

	return toAuditResponse(audit), nil
}

// GetAll returns filtered and paginated audit records.
func (s *Service) GetAll(filters AuditFilterRequest) (*AuditListResponse, error) {
	if s.repository == nil {
		return nil, errors.New("audit repository is not initialized")
	}

	// Safe pagination defaults.
	if filters.Page < 1 {
		filters.Page = 1
	}

	if filters.PageSize < 1 {
		filters.PageSize = 50
	}

	if filters.PageSize > 100 {
		filters.PageSize = 100
	}

	// Normalize and validate action filter.
	if filters.Action != nil {
		action := AuditAction(
			strings.ToLower(strings.TrimSpace(string(*filters.Action))),
		)

		if !isValidAction(action) {
			return nil, ErrInvalidAction
		}

		filters.Action = &action
	}

	// Normalize and validate resource filter.
	if filters.Resource != nil {
		resource := AuditResource(
			strings.ToLower(strings.TrimSpace(string(*filters.Resource))),
		)

		if !isValidResource(resource) {
			return nil, ErrInvalidResource
		}

		filters.Resource = &resource
	}

	// Validate date range.
	if filters.From != nil && filters.To != nil {
		if filters.From.After(*filters.To) {
			return nil, errors.New("from date cannot be after to date")
		}
	}

	// Normalize IP filter.
	filters.IPAddress = strings.TrimSpace(filters.IPAddress)

	// Fetch filtered records.
	audits, err := s.repository.FindAll(filters)
	if err != nil {
		return nil, fmt.Errorf("fetching audit records: %w", err)
	}

	// Count total matching records.
	total, err := s.repository.Count(filters)
	if err != nil {
		return nil, fmt.Errorf("counting audit records: %w", err)
	}

	responses := make([]AuditResponse, 0, len(audits))

	for i := range audits {
		response := toAuditResponse(&audits[i])

		if response != nil {
			responses = append(responses, *response)
		}
	}

	totalPages := calculateTotalPages(total, filters.PageSize)

	return &AuditListResponse{
		Audits:     responses,
		Page:       filters.Page,
		PageSize:   filters.PageSize,
		Total:      total,
		TotalPages: totalPages,
	}, nil
}

// GetByID returns a single audit record by ID.
func (s *Service) GetByID(id uint) (*AuditResponse, error) {
	if s.repository == nil {
		return nil, errors.New("audit repository is not initialized")
	}

	if id == 0 {
		return nil, ErrAuditNotFound
	}

	audit, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAuditNotFound
		}

		return nil, fmt.Errorf("fetching audit record: %w", err)
	}

	return toAuditResponse(audit), nil
}

// Delete deletes an audit record by ID.
func (s *Service) Delete(id uint) error {
	if s.repository == nil {
		return errors.New("audit repository is not initialized")
	}

	if id == 0 {
		return ErrAuditNotFound
	}

	if err := s.repository.Delete(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrAuditNotFound
		}

		return fmt.Errorf("deleting audit record: %w", err)
	}

	return nil
}

// Converts the database model into the public API response.
func toAuditResponse(audit *Audit) *AuditResponse {
	if audit == nil {
		return nil
	}

	return &AuditResponse{
		ID:         audit.ID,
		UserID:     audit.UserID,
		Action:     audit.Action,
		Resource:   audit.Resource,
		ResourceID: audit.ResourceID,
		IPAddress:  audit.IPAddress,
		UserAgent:  audit.UserAgent,
		Details:    audit.Details,
		Timestamp:  audit.Timestamp.UTC(),
		CreatedAt:  audit.CreatedAt.UTC(),
	}
}

// Validates an audit action.
func isValidAction(action AuditAction) bool {
	switch action {
	case AuditActionCreate,
		AuditActionRead,
		AuditActionUpdate,
		AuditActionDelete,
		AuditActionLogin,
		AuditActionLogout,
		AuditActionAcknowledge,
		AuditActionEscalate,
		AuditActionFalseAlert:
		return true

	default:
		return false
	}
}

// Validates an audit resource.
func isValidResource(resource AuditResource) bool {
	switch resource {
	case AuditResourceAuth,
		AuditResourceUser,
		AuditResourceCamera,
		AuditResourceZone,
		AuditResourceAlert,
		AuditResourceEvent,
		AuditResourceEvidence,
		AuditResourceSystem:
		return true

	default:
		return false
	}
}

// Calculates the number of pages.
func calculateTotalPages(total int64, pageSize int) int {
	if total <= 0 || pageSize <= 0 {
		return 0
	}

	return int((total + int64(pageSize) - 1) / int64(pageSize))
}