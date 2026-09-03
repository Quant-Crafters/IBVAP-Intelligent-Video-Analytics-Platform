package camera

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/Quant-Crafters/IBVAP-Intelligent-Video-Analytics-Platform/internal/ai"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service  *Service
	aiClient *ai.Client
}

func NewHandler(service *Service, aiClient *ai.Client) *Handler {
	return &Handler{
		service:  service,
		aiClient: aiClient,
	}
}

func (h *Handler) loadCamera(c *gin.Context) (*Camera, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid camera id"})
		return nil, false
	}
	camera, err := h.service.repository.FindByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "camera not found"})
		return nil, false
	}
	return camera, true
}

func aiRequest(camera *Camera) ai.CameraRequest {
	return ai.CameraRequest{CameraID: strconv.FormatUint(uint64(camera.ID), 10), Name: camera.Name, StreamURL: camera.StreamURL, CameraType: camera.CameraType, Enabled: true}
}

func (h *Handler) Test(c *gin.Context) {
	camera, ok := h.loadCamera(c)
	if !ok {
		return
	}
	if err := h.aiClient.Test(c.Request.Context(), aiRequest(camera)); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Camera connection successful"})
}

func (h *Handler) Start(c *gin.Context) {
	camera, ok := h.loadCamera(c)
	if !ok {
		return
	}
	status, err := h.aiClient.Start(c.Request.Context(), aiRequest(camera))
	if err != nil {
		_ = h.service.SetStatus(camera.ID, "error")
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	_ = h.service.SetStatus(camera.ID, strings.ToLower(status.State))
	c.JSON(http.StatusOK, gin.H{"camera": status})
}

func (h *Handler) action(c *gin.Context, action string) {
	camera, ok := h.loadCamera(c)
	if !ok {
		return
	}
	status, err := h.aiClient.Action(c.Request.Context(), strconv.FormatUint(uint64(camera.ID), 10), action)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	_ = h.service.SetStatus(camera.ID, strings.ToLower(status.State))
	c.JSON(http.StatusOK, gin.H{"camera": status})
}
func (h *Handler) Stop(c *gin.Context)    { h.action(c, "stop") }
func (h *Handler) Restart(c *gin.Context) { h.action(c, "restart") }

func (h *Handler) RuntimeStatus(c *gin.Context) {
	camera, ok := h.loadCamera(c)
	if !ok {
		return
	}
	status, err := h.aiClient.Status(c.Request.Context(), strconv.FormatUint(uint64(camera.ID), 10))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	_ = h.service.SetStatus(camera.ID, strings.ToLower(status.State))
	c.JSON(http.StatusOK, gin.H{"camera": status})
}

func (h *Handler) LiveStream(c *gin.Context) {
	camera, ok := h.loadCamera(c)
	if !ok {
		return
	}
	response, err := h.aiClient.Stream(c.Request.Context(), strconv.FormatUint(uint64(camera.ID), 10))
	if err != nil {
		if status, startErr := h.aiClient.Start(c.Request.Context(), aiRequest(camera)); startErr == nil && status != nil {
			_ = h.service.SetStatus(camera.ID, strings.ToLower(status.State))
			response, err = h.aiClient.Stream(c.Request.Context(), strconv.FormatUint(uint64(camera.ID), 10))
		}
	}
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	defer response.Body.Close()

	contentType := response.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "multipart/x-mixed-replace; boundary=frame"
	}

	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.Header("Connection", "keep-alive")
	c.Status(response.StatusCode)

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		_, _ = io.Copy(c.Writer, response.Body)
		return
	}

	flusher.Flush()

	buf := make([]byte, 8192)
	for {
		select {
		case <-c.Request.Context().Done():
			return
		default:
			n, rerr := response.Body.Read(buf)
			if n > 0 {
				if _, werr := c.Writer.Write(buf[:n]); werr != nil {
					return
				}
				flusher.Flush()
			}
			if rerr != nil {
				return
			}
		}
	}
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateCameraRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	camera, err := h.service.Create(req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidStatus):
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to create camera",
			})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "camera created successfully",
		"camera":  camera,
	})
}

func (h *Handler) GetAll(c *gin.Context) {
	cameras, err := h.service.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch cameras",
		})
		return
	}

	if aiStatuses, aiErr := h.aiClient.ListStatuses(c.Request.Context()); aiErr == nil && aiStatuses != nil {
		for i := range cameras {
			camIDStr := strconv.FormatUint(uint64(cameras[i].ID), 10)
			if aiStatus, ok := aiStatuses[camIDStr]; ok {
				st := strings.ToLower(aiStatus.State)
				if st == "running" || st == "starting" || st == "reconnecting" {
					cameras[i].Status = "online"
				} else {
					cameras[i].Status = "offline"
				}
				_ = h.service.SetStatus(cameras[i].ID, cameras[i].Status)
			} else {
				cameras[i].Status = "offline"
				_ = h.service.SetStatus(cameras[i].ID, "offline")
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"cameras": cameras,
	})
}

func (h *Handler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid camera id",
		})
		return
	}

	camera, err := h.service.GetByID(uint(id))
	if err != nil {
		if errors.Is(err, ErrCameraNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch camera",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"camera": camera,
	})
}

func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid camera id",
		})
		return
	}

	var req UpdateCameraRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	camera, err := h.service.Update(uint(id), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrCameraNotFound):
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
		case errors.Is(err, ErrInvalidStatus):
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to update camera",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "camera updated successfully",
		"camera":  camera,
	})
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid camera id",
		})
		return
	}

	if err := h.service.Delete(uint(id)); err != nil {
		if errors.Is(err, ErrCameraNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to delete camera",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "camera deleted successfully",
	})
}
