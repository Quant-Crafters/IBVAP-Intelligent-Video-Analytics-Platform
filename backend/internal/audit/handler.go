package audit

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

// Create creates a new audit log entry.
func (h *Handler) Create(c *gin.Context) {
	var req CreateAuditRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid audit data",
		})
		return
	}

	audit, err := h.service.Create(req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidAction),
			errors.Is(err, ErrInvalidResource):
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to create audit record",
			})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "audit record created successfully",
		"audit":   audit,
	})
}

// GetAll returns audit records with optional filters and pagination.
func (h *Handler) GetAll(c *gin.Context) {
	var filters AuditFilterRequest

	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid audit filters",
		})
		return
	}

	audits, err := h.service.GetAll(filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch audit records",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"audits": audits,
	})
}

// GetByID returns a single audit record by ID.
func (h *Handler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid audit id",
		})
		return
	}

	audit, err := h.service.GetByID(uint(id))
	if err != nil {
		if errors.Is(err, ErrAuditNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "audit record not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch audit record",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"audit": audit,
	})
}

// Delete removes an audit record by ID.
func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid audit id",
		})
		return
	}

	if err := h.service.Delete(uint(id)); err != nil {
		if errors.Is(err, ErrAuditNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "audit record not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to delete audit record",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "audit record deleted successfully",
	})
}