package zone

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
	var req CreateZoneRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	zone, err := h.service.Create(req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidZoneType),
			errors.Is(err, ErrInvalidCoordinates),
			errors.Is(err, ErrInvalidZoneName):

			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})

		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to create zone",
			})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "zone created successfully",
		"zone":    zone,
	})
}

func (h *Handler) GetAll(c *gin.Context) {
	zones, err := h.service.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch zones",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"zones": zones,
	})
}

func (h *Handler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid zone id",
		})
		return
	}

	zone, err := h.service.GetByID(uint(id))
	if err != nil {
		if errors.Is(err, ErrZoneNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch zone",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"zone": zone,
	})
}

func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid zone id",
		})
		return
	}

	var req UpdateZoneRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	zone, err := h.service.Update(uint(id), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrZoneNotFound):
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})

		case errors.Is(err, ErrInvalidZoneType),
			errors.Is(err, ErrInvalidCoordinates),
			errors.Is(err, ErrInvalidZoneName):

			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})

		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to update zone",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "zone updated successfully",
		"zone":    zone,
	})
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid zone id",
		})
		return
	}

	if err := h.service.Delete(uint(id)); err != nil {
		if errors.Is(err, ErrZoneNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to delete zone",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "zone deleted successfully",
	})
}