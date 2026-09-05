package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"

	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/config"
	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/ai"
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
		alertRepository,
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

	aiClient := ai.NewClient(cfg.AIServiceURL, cfg.AIServiceToken)

	cameraHandler := camera.NewHandler(
		cameraService,
		aiClient,
	)

	zoneHandler := zone.NewHandler(
		zoneService,
		aiClient,
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

	router.Static("/uploads", cfg.UploadDir)

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

	// ---------------------------------------------------------
	// PUBLIC AUTHENTICATION ROUTES
	// ---------------------------------------------------------
	// Register/Login must remain public.
	// ---------------------------------------------------------

	auth.RegisterRoutes(
		api,
		authHandler,
	)

	// ---------------------------------------------------------
	// PROTECTED ROUTES
	// ---------------------------------------------------------
	// Every route registered on this group requires:
	// Authorization: Bearer <valid-jwt-token>
	// ---------------------------------------------------------

	protected := api.Group("")
	protected.Use(auth.AuthMiddleware(jwtManager))

	// Users
	user.RegisterRoutes(
		protected,
		userHandler,
	)

	// Cameras
	camera.RegisterRoutes(
		protected,
		cameraHandler,
	)

	// Zones
	zone.RegisterRoutes(
		protected,
		zoneHandler,
	)

	// Alerts
	alert.RegisterRoutes(
		protected,
		alertHandler,
	)

	// Events
	event.RegisterRoutes(
		protected,
		eventHandler,
	)

	// Audit
	audit.RegisterRoutes(
		protected,
		auditHandler,
	)

	// Evidence
	evidence.RegisterRoutes(
		protected,
		evidenceHandler,
	)

	// WebSocket
	protected.GET(
		"/ws",
		websocketHandler.Connect,
	)

	// ---------------------------------------------------------
	// Start server
	// ---------------------------------------------------------

	port := os.Getenv("PORT")

	if port == "" {
		port = cfg.ServerPort
	}

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
			c.Header(
				"Access-Control-Allow-Headers",
				"Authorization, Content-Type",
			)
			c.Header(
				"Access-Control-Allow-Methods",
				"GET, POST, PUT, DELETE, OPTIONS",
			)
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
