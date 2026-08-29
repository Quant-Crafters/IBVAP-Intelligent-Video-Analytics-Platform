package evidence

import "github.com/gin-gonic/gin"

// RegisterRoutes registers all evidence-related API routes.
func RegisterRoutes(router *gin.RouterGroup, handler *Handler) {
	if router == nil || handler == nil {
		return
	}

	evidence := router.Group("/evidence")
	{
		// Create/upload evidence
		evidence.POST("/", handler.Create)

		// Get all evidence
		evidence.GET("/", handler.GetAll)

		// Get evidence by ID
		evidence.GET("/:id", handler.GetByID)

		// Delete evidence
		evidence.DELETE("/:id", handler.Delete)
	}
}