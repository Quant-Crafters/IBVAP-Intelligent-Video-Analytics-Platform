package user

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrInvalidRole  = errors.New("invalid user role")
	ErrInvalidName  = errors.New("name cannot be empty")
	ErrInvalidEmail = errors.New("email cannot be empty")
)

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

func (s *Service) GetAll() ([]UserResponse, error) {
	users, err := s.repository.FindAll()
	if err != nil {
		return nil, fmt.Errorf("fetching users: %w", err)
	}

	responses := make([]UserResponse, 0, len(users))

	for i := range users {
		responses = append(responses, *toUserResponse(&users[i]))
	}

	return responses, nil
}

func (s *Service) GetByID(id uint) (*UserResponse, error) {
	user, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}

		return nil, fmt.Errorf("fetching user: %w", err)
	}

	return toUserResponse(user), nil
}

func (s *Service) Update(id uint, req UpdateUserRequest) (*UserResponse, error) {
	user, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}

		return nil, fmt.Errorf("fetching user: %w", err)
	}

	if req.Name != "" {
		name := strings.TrimSpace(req.Name)

		if name == "" {
			return nil, ErrInvalidName
		}

		user.Name = name
	}

	if req.Email != "" {
		email := strings.TrimSpace(strings.ToLower(req.Email))

		if email == "" {
			return nil, ErrInvalidEmail
		}

		user.Email = email
	}

	if req.Role != "" {
		role := strings.TrimSpace(strings.ToLower(req.Role))

		if !isValidRole(role) {
			return nil, ErrInvalidRole
		}

		user.Role = role
	}

	if err := s.repository.Update(user); err != nil {
		return nil, fmt.Errorf("updating user: %w", err)
	}

	return toUserResponse(user), nil
}

func (s *Service) Delete(id uint) error {
	user, err := s.repository.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}

		return fmt.Errorf("fetching user: %w", err)
	}

	if err := s.repository.Delete(user.ID); err != nil {
		return fmt.Errorf("deleting user: %w", err)
	}

	return nil
}

func isValidRole(role string) bool {
	switch role {
	case "administrator", "post_commander", "security_sentry":
		return true
	default:
		return false
	}
}

func toUserResponse(user *User) *UserResponse {
	return &UserResponse{
		ID:    user.ID,
		Name:  user.Name,
		Email: user.Email,
		Role:  user.Role,
	}
}
