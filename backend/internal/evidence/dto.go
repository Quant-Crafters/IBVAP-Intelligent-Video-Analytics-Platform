package evidence


import "time"

// EvidenceType represents the type of evidence associated with an event or alert.
type EvidenceType string

const (
	EvidenceTypeImage      EvidenceType = "image"
	EvidenceTypeVideo      EvidenceType = "video"
	EvidenceTypeScreenshot EvidenceType = "screenshot"
)

// CreateEvidenceRequest represents a request to create an evidence record.
type CreateEvidenceRequest struct {
	AlertID   *uint        `json:"alert_id,omitempty"`
	EventID   *uint        `json:"event_id,omitempty"`
	Type      EvidenceType `json:"type" binding:"required,oneof=image video screenshot"`
	FilePath  string       `json:"file_path" binding:"required,max=500"`
	FileName  string       `json:"file_name" binding:"required,max=255"`
	MimeType  string       `json:"mime_type" binding:"required,max=100"`
	FileSize  int64        `json:"file_size" binding:"gte=0"`
	Timestamp time.Time    `json:"timestamp" binding:"required"`
}

// UpdateEvidenceRequest represents fields that can be updated for an evidence record.
type UpdateEvidenceRequest struct {
	FileName string `json:"file_name,omitempty" binding:"omitempty,max=255"`
	MimeType string `json:"mime_type,omitempty" binding:"omitempty,max=100"`
}

// EvidenceResponse represents the public API representation of an evidence record.
type EvidenceResponse struct {
	ID        uint         `json:"id"`
	AlertID   *uint        `json:"alert_id,omitempty"`
	EventID   *uint        `json:"event_id,omitempty"`
	Type      EvidenceType `json:"type"`
	FilePath  string       `json:"file_path"`
	FileName  string       `json:"file_name"`
	MimeType  string       `json:"mime_type"`
	FileSize  int64        `json:"file_size"`
	Timestamp time.Time    `json:"timestamp"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

// EvidenceFilterRequest represents filters supported by the evidence endpoint.
type EvidenceFilterRequest struct {
	AlertID *uint         `form:"alert_id"`
	EventID *uint         `form:"event_id"`
	Type    *EvidenceType `form:"type"`
	Page    int           `form:"page,default=1" binding:"gte=1"`
	PageSize int          `form:"page_size,default=50" binding:"gte=1,lte=100"`
}

// EvidenceListResponse represents a paginated evidence response.
type EvidenceListResponse struct {
	Evidence   []EvidenceResponse `json:"evidence"`
	Page       int                `json:"page"`
	PageSize   int                `json:"page_size"`
	Total      int64              `json:"total"`
	TotalPages int                `json:"total_pages"`
}