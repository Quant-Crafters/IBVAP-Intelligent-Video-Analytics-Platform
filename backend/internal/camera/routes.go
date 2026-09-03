package camera

import "github.com/gin-gonic/gin"

// RegisterRoutes registers all camera-related API routes.
func RegisterRoutes(
	router *gin.RouterGroup,
	handler *Handler,
) {
	if router == nil || handler == nil {
		return
	}

	cameras := router.Group("/cameras")
	{
		cameras.POST("", handler.Create)
		cameras.GET("", handler.GetAll)
		cameras.GET("/:id", handler.GetByID)
		cameras.PUT("/:id", handler.Update)
		cameras.DELETE("/:id", handler.Delete)
		cameras.POST("/:id/test", handler.Test)
		cameras.POST("/:id/start", handler.Start)
		cameras.POST("/:id/stop", handler.Stop)
		cameras.POST("/:id/restart", handler.Restart)
		cameras.GET("/:id/runtime", handler.RuntimeStatus)
		cameras.GET("/:id/live", handler.LiveStream)
	}
}
