package audit

import "github.com/gin-gonic/gin"

// RegisterRoutes registers all audit-related API routes.
func RegisterRoutes(router *gin.RouterGroup, handler *Handler) {
	if router == nil || handler == nil {
		return
	}

	audit := router.Group("/audit")
	{
		audit.GET("/", handler.GetAll)
		audit.GET("/:id", handler.GetByID)
	}
}