package evidence

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/gorm"
)

var (
	ErrEvidenceNotFound     = errors.New("evidence not found")
	ErrInvalidEvidenceType  = errors.New("invalid evidence type")
	ErrInvalidFilePath      = errors.New("invalid file path")
	ErrInvalidFileName      = errors.New("invalid file name")
	ErrInvalidMimeType      = errors.New("invalid mime type")
	ErrInvalidTimestamp     = errors.New("invalid timestamp")
	ErrInvalidEvidenceLink  = errors.New("evidence must be linked to an alert or event")
)

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

// Create creates and stores a new evidence record.
func (s *Service) Create(req CreateEvidenceRequest) (*EvidenceResponse, error) {
	if s.repository == nil {
		return nil, errors.New("evidence repository is not initialized")
	}

	// Normalize input.
	req.Type = EvidenceType(
		strings.ToLower(strings.TrimSpace(string(req.Type))),
	)
	req.FilePath = filepath.ToSlash(strings.TrimSpace(req.FilePath))
	req.FileName = strings.TrimSpace(req.FileName)
	req.MimeType = strings.ToLower(strings.TrimSpace(req.MimeType))

	// Validate evidence type.
	if !isValidEvidenceType(req.Type) {
		return nil, ErrInvalidEvidenceType
	}

	// Validate file path.
	if req.FilePath == "" {
		return nil, ErrInvalidFilePath
	}

	if len(req.FilePath) > 500 {
		return nil, ErrInvalidFilePath
	}

	// Validate file name.
	if req.FileName == "" {
		return nil, ErrInvalidFileName
	}

	if len(req.FileName) > 255 {
		return nil, ErrInvalidFileName
	}

	// Validate MIME type.
	if req.MimeType == "" {
		return nil, ErrInvalidMimeType
	}

	if len(req.MimeType) > 100 {
		return nil, ErrInvalidMimeType
	}

	// Validate timestamp.
	if req.Timestamp.IsZero() {
		return nil, ErrInvalidTimestamp
	}

	// Evidence should belong to either an alert or an event.
	if req.AlertID == nil && req.EventID == nil {
		return nil, ErrInvalidEvidenceLink
	}

	// Do not allow negative file sizes.
	if req.FileSize < 0 {
		return nil, errors.New("file size cannot be negative")
	}

	evidence := &Evidence{
		AlertID:   req.AlertID,
		EventID:   req.EventID,
		Type:      req.Type,
		FilePath:  req.FilePath,
		FileName:  req.FileName,
		MimeType:  req.MimeType,
		FileSize:  req.FileSize,
		Timestamp: req.Timestamp.UTC(),
	}

	if err := s.repository.Create(evidence); err != nil {
		return nil, fmt.Errorf("creating evidence: %w", err)
	}

	if req.EventID != nil && *req.EventID > 0 {
		_ = s.repository.UpdateEventEvidencePath(*req.EventID, req.Type, req.FilePath)
	}

	return toEvidenceResponse(evidence), nil
}

// GetAll returns filtered and paginated evidence records.
func (s *Service) GetAll(
	filters EvidenceFilterRequest,
) (*EvidenceListResponse, error) {
	if s.repository == nil {
		return nil, errors.New("evidence repository is not initialized")
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

	// Validate evidence type filter.
	if filters.Type != nil {
		normalizedType := EvidenceType(
			strings.ToLower(strings.TrimSpace(string(*filters.Type))),
		)

		if !isValidEvidenceType(normalizedType) {
			return nil, ErrInvalidEvidenceType
		}

		filters.Type = &normalizedType
	}

	// Fetch filtered records.
	evidenceRecords, err := s.repository.FindAll(filters)
	if err != nil {
		return nil, fmt.Errorf("fetching evidence records: %w", err)
	}

	// Count total matching records.
	total, err := s.repository.Count(filters)
	if err != nil {
		return nil, fmt.Errorf("counting evidence records: %w", err)
	}

	responses := make([]EvidenceResponse, 0, len(evidenceRecords))

	for i := range evidenceRecords {
		response := toEvidenceResponse(&evidenceRecords[i])

		if response != nil {
			responses = append(responses, *response)
		}
	}

	totalPages := calculateTotalPages(total, filters.PageSize)

	return &EvidenceListResponse{
		Evidence:   responses,
		Page:       filters.Page,
		PageSize:   filters.PageSize,
		Total:      total,
		TotalPages: totalPages,
	}, nil
}

// GetByID returns a single evidence record by ID.
func (s *Service) GetByID(id uint) (*EvidenceResponse, error) {
	if s.repository == nil {
		return nil, errors.New("evidence repository is not initialized")
	}

	if id == 0 {
		return nil, ErrEvidenceNotFound
	}

	evidence, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEvidenceNotFound
		}

		return nil, fmt.Errorf("fetching evidence: %w", err)
	}

	return toEvidenceResponse(evidence), nil
}

// Update updates the editable fields of an evidence record.
func (s *Service) Update(
	id uint,
	req UpdateEvidenceRequest,
) (*EvidenceResponse, error) {
	if s.repository == nil {
		return nil, errors.New("evidence repository is not initialized")
	}

	if id == 0 {
		return nil, ErrEvidenceNotFound
	}

	evidence, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEvidenceNotFound
		}

		return nil, fmt.Errorf("fetching evidence: %w", err)
	}

	// Update file name only when supplied.
	if req.FileName != "" {
		fileName := strings.TrimSpace(req.FileName)

		if fileName == "" || len(fileName) > 255 {
			return nil, ErrInvalidFileName
		}

		evidence.FileName = fileName
	}

	// Update MIME type only when supplied.
	if req.MimeType != "" {
		mimeType := strings.ToLower(strings.TrimSpace(req.MimeType))

		if mimeType == "" || len(mimeType) > 100 {
			return nil, ErrInvalidMimeType
		}

		evidence.MimeType = mimeType
	}

	if err := s.repository.Update(evidence); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEvidenceNotFound
		}

		return nil, fmt.Errorf("updating evidence: %w", err)
	}

	return toEvidenceResponse(evidence), nil
}

// Delete soft-deletes an evidence record.
func (s *Service) Delete(id uint) error {
	if s.repository == nil {
		return errors.New("evidence repository is not initialized")
	}

	if id == 0 {
		return ErrEvidenceNotFound
	}

	if err := s.repository.Delete(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrEvidenceNotFound
		}

		return fmt.Errorf("deleting evidence: %w", err)
	}

	return nil
}

// Converts the database model into the public API response.
func toEvidenceResponse(evidence *Evidence) *EvidenceResponse {
	if evidence == nil {
		return nil
	}

	return &EvidenceResponse{
		ID:        evidence.ID,
		AlertID:   evidence.AlertID,
		EventID:   evidence.EventID,
		Type:      evidence.Type,
		FilePath:  evidence.FilePath,
		FileName:  evidence.FileName,
		MimeType:  evidence.MimeType,
		FileSize:  evidence.FileSize,
		Timestamp: evidence.Timestamp.UTC(),
		CreatedAt: evidence.CreatedAt.UTC(),
		UpdatedAt: evidence.UpdatedAt.UTC(),
	}
}

// Validates the supported evidence types.
func isValidEvidenceType(evidenceType EvidenceType) bool {
	switch evidenceType {
	case EvidenceTypeImage,
		EvidenceTypeVideo,
		EvidenceTypeScreenshot:
		return true

	default:
		return false
	}
}

// Calculates the total number of pages.
func calculateTotalPages(total int64, pageSize int) int {
	if total <= 0 || pageSize <= 0 {
		return 0
	}

	return int((total + int64(pageSize) - 1) / int64(pageSize))
}

// Prevent unused import problems if time is required by future
// timestamp-related validation.
var _ time.Time