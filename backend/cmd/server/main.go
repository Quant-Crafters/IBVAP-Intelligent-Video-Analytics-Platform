package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/config"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/alert"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/audit"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/auth"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/camera"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/database"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/event"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/evidence"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/user"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/websocket"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/zone"
)

func main() {

	// ---------------------------------------------------------
	// Load configuration
	// ---------------------------------------------------------

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load application config: %v", err)
	}

	log.Println("Configuration loaded successfully")

	// ---------------------------------------------------------
	// Connect to PostgreSQL
	// ---------------------------------------------------------

	db, err := config.ConnectDatabase(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	log.Println("PostgreSQL connected successfully")

	// ---------------------------------------------------------
	// Run database migrations
	// ---------------------------------------------------------

	if err := database.Migrate(db); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	log.Println("Database migration completed successfully")

	// ---------------------------------------------------------
	// Initialize repositories
	// ---------------------------------------------------------

	authRepository := auth.NewRepository(db)
	userRepository := user.NewRepository(db)
	cameraRepository := camera.NewRepository(db)
	zoneRepository := zone.NewRepository(db)
	alertRepository := alert.NewRepository(db)
	eventRepository := event.NewRepository(db)
	auditRepository := audit.NewRepository(db)
	evidenceRepository := evidence.NewRepository(db)

	// ---------------------------------------------------------
	// Initialize JWT manager
	// ---------------------------------------------------------

	jwtManager, err := auth.NewJWTManager(cfg.JWTSecret)
	if err != nil {
		log.Fatalf("failed to initialize JWT manager: %v", err)
	}

	// ---------------------------------------------------------
	// Initialize WebSocket hub
	// ---------------------------------------------------------

	websocketHub := websocket.NewHub()

	go websocketHub.Run()

	// ---------------------------------------------------------
	// Initialize services
	// ---------------------------------------------------------

	authService := auth.NewService(
		authRepository,
		jwtManager,
	)

	userService := user.NewService(
		userRepository,
	)

	cameraService := camera.NewService(
		cameraRepository,
	)

	zoneService := zone.NewService(
		zoneRepository,
	)

	alertService := alert.NewService(
		alertRepository,
	)

	eventService := event.NewService(
		eventRepository,
	)

	auditService := audit.NewService(
		auditRepository,
	)

	evidenceService := evidence.NewService(
		evidenceRepository,
	)

	// ---------------------------------------------------------
	// Initialize handlers
	// ---------------------------------------------------------

	authHandler := auth.NewHandler(
		authService,
	)

	userHandler := user.NewHandler(
		userService,
	)

	cameraHandler := camera.NewHandler(
		cameraService,
	)

	zoneHandler := zone.NewHandler(
		zoneService,
	)

	alertHandler := alert.NewHandler(
		alertService,
	)

	/*
		event.NewHandler requires an event.Broadcaster.

		Your current websocket.Hub does NOT implement
		event.Broadcaster because Hub.Broadcast is a field,
		not a method.

		So DO NOT pass websocketHub here until the Hub is
		adapted to the Broadcaster interface.
	*/

	eventHandler := event.NewHandler(
		eventService,
		nil,
	)

	auditHandler := audit.NewHandler(
		auditService,
	)

	evidenceHandler := evidence.NewHandler(
		evidenceService,
	)

	websocketHandler := websocket.NewHandler(
		websocketHub,
	)

	// ---------------------------------------------------------
	// Create Gin router
	// ---------------------------------------------------------

	router := gin.New()

	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(corsMiddleware(cfg.AllowedOrigins))

	// ---------------------------------------------------------
	// Health check
	// ---------------------------------------------------------

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "IBVAP backend",
		})
	})

	// ---------------------------------------------------------
	// API routes
	// ---------------------------------------------------------

	api := router.Group("/api")

	// Authentication
	auth.RegisterRoutes(
		api,
		authHandler,
	)

	// Users
	user.RegisterRoutes(
		api,
		userHandler,
	)

	// Cameras
	camera.RegisterRoutes(
		api,
		cameraHandler,
	)

	// Zones
	zone.RegisterRoutes(
		api,
		zoneHandler,
	)

	// Alerts
	alert.RegisterRoutes(
		api,
		alertHandler,
	)

	// Events
	event.RegisterRoutes(
		api,
		eventHandler,
	)

	// Audit
	audit.RegisterRoutes(
		api,
		auditHandler,
	)

	// Evidence
	evidence.RegisterRoutes(
		api,
		evidenceHandler,
	)

	// WebSocket
	api.GET(
		"/ws",
		websocketHandler.Connect,
	)

	// ---------------------------------------------------------
	// Start server
	// ---------------------------------------------------------

	port := cfg.ServerPort

	if port == "" {
		port = "8080"
	}

	log.Printf("IBVAP backend starting on port %s", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[origin] = struct{}{}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, ok := allowed[origin]; ok {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		}

		if c.Request.Method == http.MethodOptions {
			if _, ok := allowed[origin]; ok {
				c.Status(http.StatusNoContent)
			} else {
				c.Status(http.StatusForbidden)
			}
			c.Abort()
			return
		}

		c.Next()
	}
}
