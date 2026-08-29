package zone

import "github.com/gin-gonic/gin"

// RegisterRoutes registers all zone-related API routes.
func RegisterRoutes(router *gin.RouterGroup, handler *Handler) {
	if router == nil || handler == nil {
		return
	}

	zones := router.Group("/zones")
	{
		zones.GET("/", handler.GetAll)
		zones.GET("/:id", handler.GetByID)
		zones.POST("/", handler.Create)
		zones.PUT("/:id", handler.Update)
		zones.DELETE("/:id", handler.Delete)
	}
}