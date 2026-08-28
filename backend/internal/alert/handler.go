package alert

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

func (h *Handler) Create(c *gin.Context) {
	var req CreateAlertRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	alert, err := h.service.Create(req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidSeverity),
			errors.Is(err, ErrInvalidStatus),
			errors.Is(err, ErrInvalidType):
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to create alert",
			})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "alert created successfully",
		"alert":   alert,
	})
}

func (h *Handler) GetAll(c *gin.Context) {
	alerts, err := h.service.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch alerts",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts": alerts,
	})
}

func (h *Handler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid alert id",
		})
		return
	}

	alert, err := h.service.GetByID(uint(id))
	if err != nil {
		if errors.Is(err, ErrAlertNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch alert",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alert": alert,
	})
}

func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid alert id",
		})
		return
	}

	var req UpdateAlertRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	alert, err := h.service.Update(uint(id), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrAlertNotFound):
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
		case errors.Is(err, ErrInvalidSeverity),
			errors.Is(err, ErrInvalidStatus),
			errors.Is(err, ErrInvalidType):
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to update alert",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "alert updated successfully",
		"alert":   alert,
	})
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid alert id",
		})
		return
	}

	if err := h.service.Delete(uint(id)); err != nil {
		if errors.Is(err, ErrAlertNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to delete alert",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "alert deleted successfully",
	})
}

// Acknowledge handles the Security Sentry alert action.
func (h *Handler) Acknowledge(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid alert id",
		})
		return
	}

	alert, err := h.service.Acknowledge(uint(id))
	if err != nil {
		if errors.Is(err, ErrAlertNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to acknowledge alert",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "alert acknowledged successfully",
		"alert":   alert,
	})
}

// Escalate handles the Post Commander alert action.
func (h *Handler) Escalate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid alert id",
		})
		return
	}

	alert, err := h.service.Escalate(uint(id))
	if err != nil {
		if errors.Is(err, ErrAlertNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to escalate alert",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "alert escalated successfully",
		"alert":   alert,
	})
}

// MarkFalseAlert handles the Post Commander false-alert action.
func (h *Handler) MarkFalseAlert(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid alert id",
		})
		return
	}

	alert, err := h.service.MarkFalseAlert(uint(id))
	if err != nil {
		if errors.Is(err, ErrAlertNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to mark alert as false",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "alert marked as false successfully",
		"alert":   alert,
	})
}
