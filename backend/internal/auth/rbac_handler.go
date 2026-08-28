package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func ProtectedTestHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userEmail, _ := c.Get("user_email")
	userRole, _ := c.Get("user_role")

	c.JSON(http.StatusOK, gin.H{
		"message": "protected route access granted",
		"user": gin.H{
			"id":    userID,
			"email": userEmail,
			"role":  userRole,
		},
	})
}
