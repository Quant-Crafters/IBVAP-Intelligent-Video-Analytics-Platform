package camera

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

var (
	ErrCameraNotFound = errors.New("camera not found")
	ErrInvalidStatus  = errors.New("invalid camera status")
)

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

func (s *Service) Create(req CreateCameraRequest) (*CameraResponse, error) {
	name := strings.TrimSpace(req.Name)
	externalID := strings.TrimSpace(req.CameraID)
	streamURL := strings.TrimSpace(req.StreamURL)
	cameraType := strings.TrimSpace(req.CameraType)
	location := strings.TrimSpace(req.Location)
	status := strings.ToLower(strings.TrimSpace(req.Status))

	if name == "" || externalID == "" || streamURL == "" || cameraType == "" || location == "" || status == "" {
		return nil, errors.New("all camera fields are required")
	}

	if !isValidStatus(status) {
		return nil, ErrInvalidStatus
	}

	camera := &Camera{
		Name:       name,
		ExternalID: externalID,
		StreamURL:  streamURL,
		CameraType: cameraType,
		Location:   location,
		Status:     status,
	}

	if err := s.repository.Create(camera); err != nil {
		return nil, fmt.Errorf("creating camera: %w", err)
	}

	return toCameraResponse(camera), nil
}

func (s *Service) GetAll() ([]CameraResponse, error) {
	cameras, err := s.repository.FindAll()
	if err != nil {
		return nil, fmt.Errorf("fetching cameras: %w", err)
	}

	responses := make([]CameraResponse, 0, len(cameras))

	for i := range cameras {
		responses = append(responses, *toCameraResponse(&cameras[i]))
	}

	return responses, nil
}

func (s *Service) GetByID(id uint) (*CameraResponse, error) {
	camera, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCameraNotFound
		}

		return nil, fmt.Errorf("finding camera: %w", err)
	}

	return toCameraResponse(camera), nil
}

func (s *Service) Update(id uint, req UpdateCameraRequest) (*CameraResponse, error) {
	camera, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCameraNotFound
		}

		return nil, fmt.Errorf("finding camera: %w", err)
	}

	name := strings.TrimSpace(req.Name)
	externalID := strings.TrimSpace(req.CameraID)
	streamURL := strings.TrimSpace(req.StreamURL)
	cameraType := strings.TrimSpace(req.CameraType)
	location := strings.TrimSpace(req.Location)
	status := strings.ToLower(strings.TrimSpace(req.Status))

	if name == "" || externalID == "" || streamURL == "" || cameraType == "" || location == "" || status == "" {
		return nil, errors.New("all camera fields are required")
	}

	if !isValidStatus(status) {
		return nil, ErrInvalidStatus
	}

	camera.Name = name
	camera.ExternalID = externalID
	camera.StreamURL = streamURL
	camera.CameraType = cameraType
	camera.Location = location
	camera.Status = status

	if err := s.repository.Update(camera); err != nil {
		return nil, fmt.Errorf("updating camera: %w", err)
	}

	return toCameraResponse(camera), nil
}

func (s *Service) Delete(id uint) error {
	camera, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrCameraNotFound
		}

		return fmt.Errorf("finding camera: %w", err)
	}

	if err := s.repository.Delete(camera); err != nil {
		return fmt.Errorf("deleting camera: %w", err)
	}

	return nil
}

func (s *Service) SetStatus(id uint, status string) error {
	camera, err := s.repository.FindByID(id)
	if err != nil {
		return err
	}
	status = strings.ToLower(strings.TrimSpace(status))
	if !isValidStatus(status) {
		return ErrInvalidStatus
	}
	camera.Status = status
	return s.repository.Update(camera)
}

func toCameraResponse(camera *Camera) *CameraResponse {
	return &CameraResponse{
		ID:         camera.ID,
		CameraID:   camera.ExternalID,
		Name:       camera.Name,
		StreamURL:  camera.StreamURL,
		CameraType: camera.CameraType,
		Location:   camera.Location,
		Status:     camera.Status,
		CreatedAt:  camera.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt:  camera.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

func isValidStatus(status string) bool {
	switch status {
	case "online", "offline", "starting", "running", "reconnecting", "error", "stopped", "stopping":
		return true
	default:
		return false
	}
}
