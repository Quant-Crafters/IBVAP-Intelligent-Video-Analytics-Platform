package alert

import "github.com/gin-gonic/gin"

// RegisterRoutes registers all alert-related API routes.
func RegisterRoutes(router *gin.RouterGroup, handler *Handler) {
	if router == nil || handler == nil {
		return
	}

	alerts := router.Group("/alerts")
	{
		alerts.GET("/", handler.GetAll)
		alerts.GET("/:id", handler.GetByID)
		alerts.POST("/", handler.Create)
		alerts.PUT("/:id", handler.Update)
		alerts.DELETE("/:id", handler.Delete)
	}
}