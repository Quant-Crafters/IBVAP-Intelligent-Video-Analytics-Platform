package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	JWTSecret string

	UploadDir string

	AllowedOrigins []string
}

func Load() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		fmt.Println("Warning: .env file not found, using environment variables")
	}

	cfg := &Config{
		ServerPort: getEnv("SERVER_PORT", "8080"),

		DBHost:     getEnv("DB_HOST", ""),
		DBPort:     getEnv("DB_PORT", ""),
		DBUser:     getEnv("DB_USER", ""),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBName:     getEnv("DB_NAME", ""),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		JWTSecret: getEnv("JWT_SECRET", ""),

		UploadDir: getEnv("UPLOAD_DIR", "uploads"),

		AllowedOrigins: splitCSV(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173")),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)

	if value == "" {
		return defaultValue
	}

	return value
}

func (c *Config) validate() error {
	required := map[string]string{
		"DB_HOST":     c.DBHost,
		"DB_PORT":     c.DBPort,
		"DB_USER":     c.DBUser,
		"DB_PASSWORD": c.DBPassword,
		"DB_NAME":     c.DBName,
		"JWT_SECRET":  c.JWTSecret,
	}

	for key, value := range required {
		if value == "" {
			return fmt.Errorf("required environment variable %s is not set", key)
		}
	}

	return nil
}

func splitCSV(value string) []string {
	items := strings.Split(value, ",")
	result := make([]string, 0, len(items))
	for _, item := range items {
		if origin := strings.TrimSpace(item); origin != "" {
			result = append(result, origin)
		}
	}
	return result
}
