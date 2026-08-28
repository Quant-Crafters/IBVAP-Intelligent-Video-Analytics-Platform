package auth

import (
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailAlreadyExists = errors.New("email already exists")
	ErrInvalidRole        = errors.New("invalid role")
)

type Service struct {
	repository *Repository
	jwtManager *JWTManager
}

func NewService(repository *Repository, jwtManager *JWTManager) *Service {
	return &Service{
		repository: repository,
		jwtManager: jwtManager,
	}
}

func (s *Service) Register(req RegisterRequest) (*UserResponse, error) {
	name := strings.TrimSpace(req.Name)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	role := strings.ToLower(strings.TrimSpace(req.Role))

	if name == "" || email == "" || req.Password == "" || role == "" {
		return nil, errors.New("all registration fields are required")
	}

	if !isValidRole(role) {
		return nil, ErrInvalidRole
	}

	existingUser, err := s.repository.FindByEmail(email)

	if err == nil && existingUser != nil {
		return nil, ErrEmailAlreadyExists
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		if err != nil {
			return nil, fmt.Errorf("checking existing user: %w", err)
		}
	}

	hashedPassword, err := bcrypt.GenerateFromPassword(
		[]byte(req.Password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	user := &User{
		Name:     name,
		Email:    email,
		Password: string(hashedPassword),
		Role:     role,
	}

	if err := s.repository.CreateUser(user); err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}

	return toUserResponse(user), nil
}

func (s *Service) Login(req LoginRequest) (*AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	user, err := s.repository.FindByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidCredentials
		}

		return nil, fmt.Errorf("finding user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword(
		[]byte(user.Password),
		[]byte(req.Password),
	); err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := s.jwtManager.GenerateToken(user)
	if err != nil {
		return nil, fmt.Errorf("generating JWT token: %w", err)
	}

	return &AuthResponse{
		Token: token,
		User:  *toUserResponse(user),
	}, nil
}

func toUserResponse(user *User) *UserResponse {
	return &UserResponse{
		ID:        user.ID,
		Name:      user.Name,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

func isValidRole(role string) bool {
	switch role {
	case "administrator", "post_commander", "security_sentry":
		return true
	default:
		return false
	}
}
