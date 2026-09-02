package event

import "time"

type EventResponse struct {
	ID        uint      `json:"id"`
	CameraID  uint      `json:"camera_id"`
	Type      string    `json:"type"`
	Severity  string    `json:"severity"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`

	// AI event data
	ExternalEventID  string  `json:"event_id"`
	Confidence       float64 `json:"confidence"`

	PersonID         *int    `json:"person_id"`
	VehicleID        *int    `json:"vehicle_id"`

	ZoneStatus       string  `json:"zone_status"`

	ObjectName       string  `json:"object_name"`
	CarriedObject    bool    `json:"carried_object"`

	VehiclePresent   bool    `json:"vehicle_present"`
	VehicleType      string  `json:"vehicle_type"`

	PlateNumber      string  `json:"plate_number"`
	PlateCountry     string  `json:"plate_country"`
	PlateConfidence  float64 `json:"plate_confidence"`

	ThreatScore      int     `json:"threat_score"`
	ThreatLevel      string  `json:"threat_level"`

	EvidenceImage    string  `json:"evidence_image"`
	IncidentClip     string  `json:"incident_clip"`
}

type EventFilterRequest struct {
	CameraID uint   `form:"camera_id"`
	Date     string `form:"date"`
	Type     string `form:"type"`
	Severity string `form:"severity"`
}

type CreateEventRequest struct {
	CameraID  uint      `json:"camera_id" binding:"required"`
	Type      string    `json:"type" binding:"required"`
	Severity  string    `json:"severity" binding:"required"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp" binding:"required"`

	// AI event data
	ExternalEventID  string  `json:"event_id"`
	Confidence       float64 `json:"confidence"`

	PersonID         *int    `json:"person_id"`
	VehicleID        *int    `json:"vehicle_id"`

	ZoneStatus       string  `json:"zone_status"`

	ObjectName       string  `json:"object_name"`
	CarriedObject    bool    `json:"carried_object"`

	VehiclePresent   bool    `json:"vehicle_present"`
	VehicleType      string  `json:"vehicle_type"`

	PlateNumber      string  `json:"plate_number"`
	PlateCountry     string  `json:"plate_country"`
	PlateConfidence  float64 `json:"plate_confidence"`

	ThreatScore      int     `json:"threat_score"`
	ThreatLevel      string  `json:"threat_level"`

	EvidenceImage    string  `json:"evidence_image"`
	IncidentClip     string  `json:"incident_clip"`
}