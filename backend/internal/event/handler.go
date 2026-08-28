package event

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Broadcaster interface {
	Broadcast(message interface{})
}

type Handler struct {
	service    *Service
	broadcaster Broadcaster
}

func NewHandler(service *Service, broadcaster Broadcaster) *Handler {
	return &Handler{
		service:    service,
		broadcaster: broadcaster,
	}
}

// GetAll returns event history with optional filters.
func (h *Handler) GetAll(c *gin.Context) {
	var filters EventFilterRequest

	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid query parameters",
		})
		return
	}

	events, err := h.service.GetAll(filters)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"events": events,
	})
}

// GetByID returns a single event by ID.
func (h *Handler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid event id",
		})
		return
	}

	event, err := h.service.GetByID(uint(id))
	if err != nil {
		if errors.Is(err, ErrEventNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "event not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"event": event,
	})
}

// Create creates a new event and broadcasts it to connected WebSocket clients.
func (h *Handler) Create(c *gin.Context) {
	var req CreateEventRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid event data",
		})
		return
	}

	event, err := h.service.Create(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Broadcast the newly created event to all connected WebSocket clients.
	if h.broadcaster != nil {
		h.broadcaster.Broadcast(gin.H{
			"event": event,
		})
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "event created successfully",
		"event":   event,
	})
}