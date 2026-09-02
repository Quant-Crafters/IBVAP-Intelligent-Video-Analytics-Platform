package evidence

import "github.com/gin-gonic/gin"

// RegisterRoutes registers all evidence-related API routes.
func RegisterRoutes(router *gin.RouterGroup, handler *Handler) {
	if router == nil || handler == nil {
		return
	}

	evidence := router.Group("/evidence")
	{
		// Create evidence record using JSON
		evidence.POST("/", handler.Create)

		// Upload actual evidence file (image/video)
		evidence.POST("/upload", handler.Upload)

		// Get all evidence
		evidence.GET("/", handler.GetAll)

		// Get evidence by ID
		evidence.GET("/:id", handler.GetByID)

		// Delete evidence
		evidence.DELETE("/:id", handler.Delete)
	}
}