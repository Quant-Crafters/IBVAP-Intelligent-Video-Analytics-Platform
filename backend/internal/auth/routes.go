package auth

import "github.com/gin-gonic/gin"

// RegisterRoutes registers all authentication-related routes.
func RegisterRoutes(
	router *gin.RouterGroup,
	handler *Handler,
) {
	if router == nil || handler == nil {
		return
	}

	auth := router.Group("/auth")
	{
		auth.POST("/register", handler.Register)
		auth.POST("/login", handler.Login)
	}
}