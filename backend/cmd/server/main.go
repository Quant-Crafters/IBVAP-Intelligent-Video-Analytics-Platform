package main

import (
	"fmt"
	"log"

	"github.com/gin-gonic/gin"

	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/config"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/alert"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/auth"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/camera"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/database"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/event"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/user"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/websocket"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/zone"
)

func main() {

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("configuration error: %v", err)
	}

	db, err := config.ConnectDatabase(cfg)
	if err != nil {
		log.Fatalf("database connection error: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		log.Fatalf("migration error: %v", err)
	}

	fmt.Println("Database migration completed successfully")

	jwtManager, err := auth.NewJWTManager(cfg.JWTSecret)
	if err != nil {
		log.Fatalf("JWT configuration error: %v", err)
	}

	fmt.Println("JWT configuration loaded successfully")

	// Auth components
	authRepository := auth.NewRepository(db)
	authService := auth.NewService(authRepository, jwtManager)
	authHandler := auth.NewHandler(authService)

	// Camera components
	cameraRepository := camera.NewRepository(db)
	cameraService := camera.NewService(cameraRepository)
	cameraHandler := camera.NewHandler(cameraService)

	// Alert components
	alertRepository := alert.NewRepository(db)
	alertService := alert.NewService(alertRepository)
	alertHandler := alert.NewHandler(alertService)

	// User components
	userRepository := user.NewRepository(db)
	userService := user.NewService(userRepository)
	userHandler := user.NewHandler(userService)

	// Zone components
	zoneRepository := zone.NewRepository(db)
	zoneService := zone.NewService(zoneRepository)
	zoneHandler := zone.NewHandler(zoneService)

	// WebSocket components
	websocketHub := websocket.NewHub()
	websocketHandler := websocket.NewHandler(websocketHub)

	// Event components
	eventRepository := event.NewRepository(db)
	eventService := event.NewService(eventRepository)
	eventHandler := event.NewHandler(eventService, websocketHub)

	fmt.Println("Auth components initialized successfully")
	fmt.Println("Camera components initialized successfully")
	fmt.Println("Alert components initialized successfully")
	fmt.Println("User components initialized successfully")
	fmt.Println("Zone components initialized successfully")
	fmt.Println("Event components initialized successfully")
	fmt.Println("WebSocket components initialized successfully")

	router := gin.Default()

	// Authentication routes
	authRoutes := router.Group("/api/auth")
	{
		authRoutes.POST("/register", authHandler.Register)
		authRoutes.POST("/login", authHandler.Login)
	}

	// Protected routes
	protectedRoutes := router.Group("/api/protected")
	protectedRoutes.Use(auth.AuthMiddleware(jwtManager))
	{
		protectedRoutes.GET(
			"/test",
			auth.RequireRoles(
				"administrator",
				"post_commander",
				"security_sentry",
			),
			auth.ProtectedTestHandler,
		)
	}

	// Camera routes
	cameraRoutes := router.Group("/api/cameras")
	cameraRoutes.Use(auth.AuthMiddleware(jwtManager))
	{
		cameraRoutes.GET("", cameraHandler.GetAll)
		cameraRoutes.GET("/:id", cameraHandler.GetByID)

		cameraRoutes.POST(
			"",
			auth.RequireRoles("administrator"),
			cameraHandler.Create,
		)

		cameraRoutes.PUT(
			"/:id",
			auth.RequireRoles("administrator"),
			cameraHandler.Update,
		)

		cameraRoutes.DELETE(
			"/:id",
			auth.RequireRoles("administrator"),
			cameraHandler.Delete,
		)
	}

	// Alert routes
	alertRoutes := router.Group("/api/alerts")
	alertRoutes.Use(auth.AuthMiddleware(jwtManager))
	{
		alertRoutes.GET("", alertHandler.GetAll)
		alertRoutes.GET("/:id", alertHandler.GetByID)

		alertRoutes.POST(
			"/:id/acknowledge",
			auth.RequireRoles("security_sentry"),
			alertHandler.Acknowledge,
		)

		alertRoutes.POST(
			"/:id/escalate",
			auth.RequireRoles("post_commander"),
			alertHandler.Escalate,
		)

		alertRoutes.POST(
			"/:id/false-alert",
			auth.RequireRoles("post_commander"),
			alertHandler.MarkFalseAlert,
		)
	}

	// User management routes
	userRoutes := router.Group("/api/users")
	userRoutes.Use(auth.AuthMiddleware(jwtManager))
	{
		userRoutes.GET(
			"",
			auth.RequireRoles("administrator"),
			userHandler.GetAll,
		)

		userRoutes.GET(
			"/:id",
			auth.RequireRoles("administrator"),
			userHandler.GetByID,
		)

		userRoutes.PUT(
			"/:id",
			auth.RequireRoles("administrator"),
			userHandler.Update,
		)

		userRoutes.DELETE(
			"/:id",
			auth.RequireRoles("administrator"),
			userHandler.Delete,
		)
	}

	// Zone / Virtual Fence routes
	zoneRoutes := router.Group("/api/zones")
	zoneRoutes.Use(auth.AuthMiddleware(jwtManager))
	{
		zoneRoutes.GET("", zoneHandler.GetAll)
		zoneRoutes.GET("/:id", zoneHandler.GetByID)

		zoneRoutes.POST(
			"",
			auth.RequireRoles("administrator"),
			zoneHandler.Create,
		)

		zoneRoutes.PUT(
			"/:id",
			auth.RequireRoles("administrator"),
			zoneHandler.Update,
		)

		zoneRoutes.DELETE(
			"/:id",
			auth.RequireRoles("administrator"),
			zoneHandler.Delete,
		)
	}

	// Event History routes
	eventRoutes := router.Group("/api/events")
	eventRoutes.Use(auth.AuthMiddleware(jwtManager))
	{
		eventRoutes.GET(
			"",
			auth.RequireRoles(
				"administrator",
				"post_commander",
				"security_sentry",
			),
			eventHandler.GetAll,
		)

		eventRoutes.GET(
			"/:id",
			auth.RequireRoles(
				"administrator",
				"post_commander",
				"security_sentry",
			),
			eventHandler.GetByID,
		)

		// Event creation endpoint
		eventRoutes.POST(
			"",
			eventHandler.Create,
		)
	}

	// WebSocket route
	websocketRoutes := router.Group("/api")
	websocketRoutes.Use(auth.AuthMiddleware(jwtManager))
	{
		websocketRoutes.GET("/ws", websocketHandler.Connect)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("database instance error: %v", err)
	}

	defer sqlDB.Close()

	fmt.Println("PostgreSQL connected successfully")
	fmt.Printf("IBVAP server running on port %s\n", cfg.ServerPort)

	if err := router.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("server error: %v", err)
	}
}