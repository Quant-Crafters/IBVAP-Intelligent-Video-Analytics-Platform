package evidence

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// Create handles creation of a new evidence record.
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
				"error": "failed to create evidence",
			})
		}

		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "evidence created successfully",
		"evidence": evidence,
	})
}

// GetAll returns filtered and paginated evidence records.
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

// GetByID returns a single evidence record by ID.
func (h *Handler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
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

// Update updates an existing evidence record.
func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
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

	evidence, err := h.service.Update(uint(id), req)
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

// Delete deletes an evidence record.
func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
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