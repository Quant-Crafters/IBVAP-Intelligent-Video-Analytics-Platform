package camera

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
	var req CreateCameraRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	camera, err := h.service.Create(req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidStatus):
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to create camera",
			})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "camera created successfully",
		"camera":  camera,
	})
}

func (h *Handler) GetAll(c *gin.Context) {
	cameras, err := h.service.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch cameras",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cameras": cameras,
	})
}

func (h *Handler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid camera id",
		})
		return
	}

	camera, err := h.service.GetByID(uint(id))
	if err != nil {
		if errors.Is(err, ErrCameraNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch camera",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"camera": camera,
	})
}

func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid camera id",
		})
		return
	}

	var req UpdateCameraRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	camera, err := h.service.Update(uint(id), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrCameraNotFound):
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
		case errors.Is(err, ErrInvalidStatus):
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to update camera",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "camera updated successfully",
		"camera":  camera,
	})
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid camera id",
		})
		return
	}

	if err := h.service.Delete(uint(id)); err != nil {
		if errors.Is(err, ErrCameraNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to delete camera",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "camera deleted successfully",
	})
}
