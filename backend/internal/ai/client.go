package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL          string
	token            string
	httpClient       *http.Client
	streamHttpClient *http.Client
}

type CameraRequest struct {
	CameraID   string  `json:"camera_id"`
	Name       string  `json:"name"`
	StreamURL  string  `json:"stream_url"`
	CameraType string  `json:"camera_type"`
	Enabled    bool    `json:"enabled"`
	Zone       [][]int `json:"zone,omitempty"`
}

type CameraStatus struct {
	CameraID     string `json:"camera_id"`
	State        string `json:"state"`
	ErrorMessage string `json:"error_message"`
	HasZone      bool   `json:"has_zone"`
}

func NewClient(baseURL, token string) *Client {
	return &Client{
		baseURL:          strings.TrimRight(baseURL, "/"),
		token:            token,
		httpClient:       &http.Client{Timeout: 15 * time.Second},
		streamHttpClient: &http.Client{Timeout: 0},
	}
}

func (c *Client) do(ctx context.Context, method, path string, payload any, result any) (*http.Response, error) {
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-AI-Service-Token", c.token)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	response, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("AI engine unavailable: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		defer response.Body.Close()
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return nil, fmt.Errorf("AI engine returned %s: %s", response.Status, strings.TrimSpace(string(message)))
	}
	if result != nil {
		defer response.Body.Close()
		if err := json.NewDecoder(response.Body).Decode(result); err != nil {
			return nil, err
		}
	}
	return response, nil
}

func (c *Client) Test(ctx context.Context, request CameraRequest) error {
	_, err := c.do(ctx, http.MethodPost, "/api/v1/cameras/test", request, &map[string]any{})
	return err
}
func (c *Client) Start(ctx context.Context, request CameraRequest) (*CameraStatus, error) {
	var response struct {
		Camera CameraStatus `json:"camera"`
	}
	_, err := c.do(ctx, http.MethodPost, "/api/v1/cameras/start", request, &response)
	return &response.Camera, err
}
func (c *Client) Action(ctx context.Context, cameraID, action string) (*CameraStatus, error) {
	var response struct {
		Camera CameraStatus `json:"camera"`
	}
	_, err := c.do(ctx, http.MethodPost, "/api/v1/cameras/"+cameraID+"/"+action, nil, &response)
	return &response.Camera, err
}
func (c *Client) Status(ctx context.Context, cameraID string) (*CameraStatus, error) {
	var response CameraStatus
	_, err := c.do(ctx, http.MethodGet, "/api/v1/cameras/"+cameraID, nil, &response)
	return &response, err
}
func (c *Client) ListStatuses(ctx context.Context) (map[string]CameraStatus, error) {
	var response struct {
		Count   int            `json:"count"`
		Cameras []CameraStatus `json:"cameras"`
	}
	_, err := c.do(ctx, http.MethodGet, "/api/v1/cameras", nil, &response)
	if err != nil {
		return nil, err
	}
	result := make(map[string]CameraStatus, len(response.Cameras))
	for _, status := range response.Cameras {
		result[status.CameraID] = status
	}
	return result, nil
}
func (c *Client) UpdateZone(ctx context.Context, cameraID string, zone [][]int) error {
	_, err := c.do(ctx, http.MethodPut, "/api/v1/cameras/"+cameraID+"/zone", map[string]any{"zone": zone}, &map[string]any{})
	return err
}
func (c *Client) Stream(ctx context.Context, cameraID string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/cameras/"+cameraID+"/stream", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-AI-Service-Token", c.token)
	response, err := c.streamHttpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("AI engine stream unavailable: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		defer response.Body.Close()
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return nil, fmt.Errorf("AI engine returned %s: %s", response.Status, strings.TrimSpace(string(message)))
	}
	return response, nil
}
