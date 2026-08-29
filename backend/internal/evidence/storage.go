package evidence

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidFile      = errors.New("invalid file")
	ErrInvalidFileType  = errors.New("invalid file type")
	ErrFileTooLarge     = errors.New("file exceeds maximum allowed size")
	ErrStorageFailed    = errors.New("failed to store file")
	ErrFileNotFound     = errors.New("file not found")
	ErrDeleteFileFailed = errors.New("failed to delete file")
)

// Storage handles evidence file storage.
type Storage struct {
	BasePath      string
	MaxFileSize   int64
	AllowedImages map[string]bool
	AllowedVideos map[string]bool
	AllowedFiles  map[string]bool
}

// NewStorage creates a new evidence storage service.
func NewStorage(basePath string, maxFileSize int64) (*Storage, error) {
	basePath = strings.TrimSpace(basePath)

	if basePath == "" {
		return nil, errors.New("storage base path is required")
	}

	if maxFileSize <= 0 {
		return nil, errors.New("maximum file size must be greater than zero")
	}

	storage := &Storage{
		BasePath:    basePath,
		MaxFileSize: maxFileSize,

		AllowedImages: map[string]bool{
			".jpg":  true,
			".jpeg": true,
			".png":  true,
			".webp": true,
		},

		AllowedVideos: map[string]bool{
			".mp4":  true,
			".webm": true,
			".mov":  true,
			".avi":  true,
			".mkv":  true,
		},

		AllowedFiles: map[string]bool{
			".jpg":  true,
			".jpeg": true,
			".png":  true,
			".webp": true,
			".mp4":  true,
			".webm": true,
			".mov":  true,
			".avi":  true,
			".mkv":  true,
		},
	}

	if err := os.MkdirAll(basePath, 0750); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrStorageFailed, err)
	}

	return storage, nil
}

// Store saves an evidence file and returns its relative storage path.
func (s *Storage) Store(
	reader io.Reader,
	originalName string,
	fileSize int64,
) (string, error) {

	if reader == nil {
		return "", ErrInvalidFile
	}

	if strings.TrimSpace(originalName) == "" {
		return "", ErrInvalidFile
	}

	if fileSize <= 0 {
		return "", ErrInvalidFile
	}

	if fileSize > s.MaxFileSize {
		return "", ErrFileTooLarge
	}

	extension := strings.ToLower(filepath.Ext(originalName))

	if !s.AllowedFiles[extension] {
		return "", ErrInvalidFileType
	}

	// Generate a random filename instead of trusting the
	// user-provided filename.
	uniqueName := uuid.New().String() + extension

	subDirectory := "files"

	if s.AllowedImages[extension] {
		subDirectory = "images"
	} else if s.AllowedVideos[extension] {
		subDirectory = "videos"
	}

	directory := filepath.Join(s.BasePath, subDirectory)

	if err := os.MkdirAll(directory, 0750); err != nil {
		return "", fmt.Errorf("%w: %v", ErrStorageFailed, err)
	}

	filePath := filepath.Join(directory, uniqueName)

	// Make absolutely sure the final path remains inside
	// the configured storage directory.
	absBase, err := filepath.Abs(s.BasePath)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrStorageFailed, err)
	}

	absFile, err := filepath.Abs(filePath)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrStorageFailed, err)
	}

	relativePath, err := filepath.Rel(absBase, absFile)
	if err != nil || strings.HasPrefix(relativePath, "..") {
		return "", ErrStorageFailed
	}

	file, err := os.OpenFile(
		filePath,
		os.O_WRONLY|os.O_CREATE|os.O_EXCL,
		0600,
	)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrStorageFailed, err)
	}

	defer file.Close()

	// Limit the reader so a malicious client cannot write
	// more than the configured maximum even if the supplied
	// fileSize is incorrect.
	limitedReader := io.LimitReader(reader, s.MaxFileSize+1)

	written, err := io.Copy(file, limitedReader)
	if err != nil {
		_ = os.Remove(filePath)
		return "", fmt.Errorf("%w: %v", ErrStorageFailed, err)
	}

	if written > s.MaxFileSize {
		_ = os.Remove(filePath)
		return "", ErrFileTooLarge
	}

	return filepath.ToSlash(filepath.Join(subDirectory, uniqueName)), nil
}

// StoreFromFile stores an already opened file.
func (s *Storage) StoreFromFile(
	file *os.File,
	originalName string,
) (string, error) {

	if file == nil {
		return "", ErrInvalidFile
	}

	info, err := file.Stat()
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidFile, err)
	}

	if info.IsDir() {
		return "", ErrInvalidFile
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidFile, err)
	}

	return s.Store(
		file,
		originalName,
		info.Size(),
	)
}

// Delete removes an evidence file.
func (s *Storage) Delete(relativePath string) error {
	relativePath = strings.TrimSpace(relativePath)

	if relativePath == "" {
		return ErrFileNotFound
	}

	absBase, err := filepath.Abs(s.BasePath)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrDeleteFileFailed, err)
	}

	cleanPath := filepath.Clean(relativePath)

	// Prevent absolute paths and path traversal.
	if filepath.IsAbs(cleanPath) {
		return ErrDeleteFileFailed
	}

	fullPath := filepath.Join(absBase, cleanPath)

	absFile, err := filepath.Abs(fullPath)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrDeleteFileFailed, err)
	}

	relative, err := filepath.Rel(absBase, absFile)
	if err != nil || strings.HasPrefix(relative, "..") {
		return ErrDeleteFileFailed
	}

	if err := os.Remove(absFile); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return ErrFileNotFound
		}

		return fmt.Errorf("%w: %v", ErrDeleteFileFailed, err)
	}

	return nil
}

// Exists checks whether an evidence file exists.
func (s *Storage) Exists(relativePath string) bool {
	relativePath = strings.TrimSpace(relativePath)

	if relativePath == "" || filepath.IsAbs(relativePath) {
		return false
	}

	absBase, err := filepath.Abs(s.BasePath)
	if err != nil {
		return false
	}

	fullPath := filepath.Join(absBase, filepath.Clean(relativePath))

	absFile, err := filepath.Abs(fullPath)
	if err != nil {
		return false
	}

	relative, err := filepath.Rel(absBase, absFile)
	if err != nil || strings.HasPrefix(relative, "..") {
		return false
	}

	info, err := os.Stat(absFile)
	if err != nil {
		return false
	}

	return !info.IsDir()
}

// GetAbsolutePath converts a stored relative path into an
// absolute filesystem path after validating that it remains
// inside the configured storage directory.
func (s *Storage) GetAbsolutePath(relativePath string) (string, error) {
	relativePath = strings.TrimSpace(relativePath)

	if relativePath == "" || filepath.IsAbs(relativePath) {
		return "", ErrFileNotFound
	}

	absBase, err := filepath.Abs(s.BasePath)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrStorageFailed, err)
	}

	fullPath := filepath.Join(absBase, filepath.Clean(relativePath))

	absFile, err := filepath.Abs(fullPath)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrStorageFailed, err)
	}

	relative, err := filepath.Rel(absBase, absFile)
	if err != nil || strings.HasPrefix(relative, "..") {
		return "", ErrFileNotFound
	}

	return absFile, nil
}

// CleanupEmptyDirectories removes empty directories created
// inside the evidence storage directory.
func (s *Storage) CleanupEmptyDirectories() error {
	entries, err := os.ReadDir(s.BasePath)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrStorageFailed, err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		dirPath := filepath.Join(s.BasePath, entry.Name())

		contents, err := os.ReadDir(dirPath)
		if err != nil {
			continue
		}

		if len(contents) == 0 {
			_ = os.Remove(dirPath)
		}
	}

	return nil
}

// GenerateEvidenceID generates a unique identifier that can be
// used when creating evidence records.
func GenerateEvidenceID() string {
	return uuid.New().String()
}

// TimestampedFilename generates a unique timestamp-based filename.
// The extension is validated before returning.
func TimestampedFilename(originalName string) (string, error) {
	extension := strings.ToLower(filepath.Ext(originalName))

	if extension == "" {
		return "", ErrInvalidFileType
	}

	timestamp := time.Now().UTC().Format("20060102T150405.000000000Z")

	return fmt.Sprintf(
		"%s_%s%s",
		timestamp,
		uuid.New().String(),
		extension,
	), nil
}
