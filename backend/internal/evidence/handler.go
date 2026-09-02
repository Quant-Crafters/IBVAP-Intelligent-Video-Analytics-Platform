package evidence

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	maxEvidenceFileSize int64 = 100 * 1024 * 1024 // 100 MB

	evidenceUploadDir = "uploads/evidence"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// ============================================================
// CREATE
// ============================================================

// Create handles creation of a new evidence record using JSON.
func (h *Handler) Create(c *gin.Context) {
	var req CreateEvidenceRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	evidence, err := h.service.Create(req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidEvidenceType),
			errors.Is(err, ErrInvalidFilePath),
			errors.Is(err, ErrInvalidFileName),
			errors.Is(err, ErrInvalidMimeType):

			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})

		default:

			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to create evidence",
				"details": err.Error(),
			})
		}

		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "evidence created successfully",
		"evidence": evidence,
	})
}

// ============================================================
// UPLOAD
// ============================================================

// Upload handles actual evidence file uploads.
//
// Expected multipart/form-data:
//
// file      -> JPG/PNG/MP4/WEBM
// event_id  -> numeric backend Event ID
// type      -> image / video / screenshot
func (h *Handler) Upload(c *gin.Context) {

	// --------------------------------------------------------
	// EVENT ID
	// --------------------------------------------------------

	eventIDString := strings.TrimSpace(
		c.PostForm("event_id"),
	)

	if eventIDString == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "event_id is required",
		})
		return
	}

	eventID, err := strconv.ParseUint(
		eventIDString,
		10,
		64,
	)

	if err != nil || eventID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid event_id",
		})
		return
	}

	// --------------------------------------------------------
	// EVIDENCE TYPE
	// --------------------------------------------------------

	evidenceType := EvidenceType(
		strings.ToLower(
			strings.TrimSpace(
				c.PostForm("type"),
			),
		),
	)

	switch evidenceType {
	case EvidenceTypeImage,
		EvidenceTypeVideo,
		EvidenceTypeScreenshot:

		// Valid.

	default:

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "type must be image, video, or screenshot",
		})
		return
	}

	// --------------------------------------------------------
	// FILE
	// --------------------------------------------------------

	fileHeader, err := c.FormFile("file")

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "file is required",
		})
		return
	}

	// --------------------------------------------------------
	// FILE SIZE
	// --------------------------------------------------------

	if fileHeader.Size <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "uploaded file is empty",
		})
		return
	}

	if fileHeader.Size > maxEvidenceFileSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error": "file size exceeds 100 MB limit",
		})
		return
	}

	// --------------------------------------------------------
	// SAFE ORIGINAL FILE NAME
	// --------------------------------------------------------

	originalName := filepath.Base(
		fileHeader.Filename,
	)

	if originalName == "." ||
		originalName == string(filepath.Separator) ||
		originalName == "" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid file name",
		})
		return
	}

	// --------------------------------------------------------
	// FILE EXTENSION
	// --------------------------------------------------------

	extension := strings.ToLower(
		filepath.Ext(originalName),
	)

	allowedExtensions := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".mp4":  true,
		".webm": true,
		".mov":  true,
	}

	if !allowedExtensions[extension] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "unsupported file type; allowed: jpg, jpeg, png, mp4, webm, mov",
		})
		return
	}

	// --------------------------------------------------------
	// VERIFY TYPE / EXTENSION CONSISTENCY
	// --------------------------------------------------------

	if evidenceType == EvidenceTypeImage ||
		evidenceType == EvidenceTypeScreenshot {

		if extension != ".jpg" &&
			extension != ".jpeg" &&
			extension != ".png" {

			c.JSON(http.StatusBadRequest, gin.H{
				"error": "image/screenshot evidence must be JPG, JPEG, or PNG",
			})
			return
		}
	}

	if evidenceType == EvidenceTypeVideo {

		if extension != ".mp4" &&
			extension != ".webm" &&
			extension != ".mov" {

			c.JSON(http.StatusBadRequest, gin.H{
				"error": "video evidence must be MP4, WEBM, or MOV",
			})
			return
		}
	}

	// --------------------------------------------------------
	// MIME TYPE
	// --------------------------------------------------------

	mimeType := strings.ToLower(
		strings.TrimSpace(
			fileHeader.Header.Get("Content-Type"),
		),
	)

	// Some clients may not provide a MIME type.
	if mimeType == "" ||
		mimeType == "application/octet-stream" {

		switch extension {

		case ".jpg", ".jpeg":
			mimeType = "image/jpeg"

		case ".png":
			mimeType = "image/png"

		case ".mp4":
			mimeType = "video/mp4"

		case ".webm":
			mimeType = "video/webm"

		case ".mov":
			mimeType = "video/quicktime"
		}
	}

	// --------------------------------------------------------
	// CREATE UPLOAD DIRECTORY
	// --------------------------------------------------------

	if err := os.MkdirAll(
		evidenceUploadDir,
		0755,
	); err != nil {

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to create evidence storage directory",
		})
		return
	}

	// --------------------------------------------------------
	// GENERATE UNIQUE FILE NAME
	// --------------------------------------------------------

	timestamp := time.Now().UTC().Format(
		"20060102_150405.000000000",
	)

	uniqueName := fmt.Sprintf(
		"event_%d_%s%s",
		eventID,
		strings.ReplaceAll(timestamp, ".", "_"),
		extension,
	)

	storagePath := filepath.Join(
		evidenceUploadDir,
		uniqueName,
	)

	// --------------------------------------------------------
	// SAVE ACTUAL FILE
	// --------------------------------------------------------

	if err := c.SaveUploadedFile(
		fileHeader,
		storagePath,
	); err != nil {

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to save evidence file",
		})
		return
	}

	// --------------------------------------------------------
	// CREATE DATABASE EVIDENCE RECORD
	// --------------------------------------------------------

	eventIDUint := uint(eventID)

	req := CreateEvidenceRequest{
		EventID:   &eventIDUint,
		Type:      evidenceType,
		FilePath:  storagePath,
		FileName:  uniqueName,
		MimeType:  mimeType,
		FileSize:  fileHeader.Size,
		Timestamp: time.Now().UTC(),
	}

	evidence, err := h.service.Create(req)

	if err != nil {

		// Database record failed.
		// Remove the physical file so we don't leave orphan files.
		_ = os.Remove(storagePath)

		switch {

		case errors.Is(err, ErrInvalidEvidenceType),
			errors.Is(err, ErrInvalidFilePath),
			errors.Is(err, ErrInvalidFileName),
			errors.Is(err, ErrInvalidMimeType),
			errors.Is(err, ErrInvalidTimestamp),
			errors.Is(err, ErrInvalidEvidenceLink):

			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})

		default:

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to create evidence record",
			})
		}

		return
	}

	// --------------------------------------------------------
	// SUCCESS
	// --------------------------------------------------------

	c.JSON(http.StatusCreated, gin.H{
		"message":  "evidence uploaded successfully",
		"evidence": evidence,
	})
}

// ============================================================
// GET ALL
// ============================================================

func (h *Handler) GetAll(c *gin.Context) {
	var filters EvidenceFilterRequest

	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid query parameters",
		})
		return
	}

	evidence, err := h.service.GetAll(filters)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidEvidenceType):

			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})

		default:

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to fetch evidence",
			})
		}

		return
	}

	c.JSON(http.StatusOK, evidence)
}

// ============================================================
// GET BY ID
// ============================================================

func (h *Handler) GetByID(c *gin.Context) {

	id, err := strconv.ParseUint(
		c.Param("id"),
		10,
		64,
	)

	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid evidence id",
		})
		return
	}

	evidence, err := h.service.GetByID(uint(id))

	if err != nil {

		if errors.Is(err, ErrEvidenceNotFound) {

			c.JSON(http.StatusNotFound, gin.H{
				"error": "evidence not found",
			})

			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch evidence",
		})

		return
	}

	c.JSON(http.StatusOK, gin.H{
		"evidence": evidence,
	})
}

// ============================================================
// UPDATE
// ============================================================

func (h *Handler) Update(c *gin.Context) {

	id, err := strconv.ParseUint(
		c.Param("id"),
		10,
		64,
	)

	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid evidence id",
		})
		return
	}

	var req UpdateEvidenceRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	evidence, err := h.service.Update(
		uint(id),
		req,
	)

	if err != nil {

		switch {

		case errors.Is(err, ErrEvidenceNotFound):

			c.JSON(http.StatusNotFound, gin.H{
				"error": "evidence not found",
			})

		case errors.Is(err, ErrInvalidFileName),
			errors.Is(err, ErrInvalidMimeType):

			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})

		default:

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to update evidence",
			})
		}

		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "evidence updated successfully",
		"evidence": evidence,
	})
}

// ============================================================
// DELETE
// ============================================================

func (h *Handler) Delete(c *gin.Context) {

	id, err := strconv.ParseUint(
		c.Param("id"),
		10,
		64,
	)

	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid evidence id",
		})
		return
	}

	if err := h.service.Delete(uint(id)); err != nil {

		if errors.Is(err, ErrEvidenceNotFound) {

			c.JSON(http.StatusNotFound, gin.H{
				"error": "evidence not found",
			})

			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to delete evidence",
		})

		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "evidence deleted successfully",
	})
}
