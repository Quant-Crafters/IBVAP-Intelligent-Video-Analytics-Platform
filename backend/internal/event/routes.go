package event

import "github.com/gin-gonic/gin"

// RegisterRoutes registers all event-related API routes.
func RegisterRoutes(
	router *gin.RouterGroup,
	handler *Handler,
) {
	if router == nil || handler == nil {
		return
	}

	events := router.Group("/events")
	{
		// Create a new event.
		events.POST("", handler.Create)

		// Get event history with optional filters.
		events.GET("", handler.GetAll)

		// Clear test events and alerts.
		events.DELETE("/clear", handler.Clear)

		// Get a single event by ID.
		events.GET("/:id", handler.GetByID)
	}
}