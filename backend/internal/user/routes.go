package user

import "github.com/gin-gonic/gin"

// RegisterRoutes registers all user-related routes.
func RegisterRoutes(
	router *gin.RouterGroup,
	handler *Handler,
) {
	if router == nil || handler == nil {
		return
	}

	users := router.Group("/users")
	{
		users.GET("", handler.GetAll)
		users.GET("/:id", handler.GetByID)
		users.PUT("/:id", handler.Update)
		users.DELETE("/:id", handler.Delete)
	}
}