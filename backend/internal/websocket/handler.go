package websocket

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	gws "github.com/gorilla/websocket"
)

const (
	// Maximum amount of time allowed to write a message.
	writeWait = 10 * time.Second

	// Maximum amount of time allowed to read the next message.
	pongWait = 60 * time.Second

	// Send pings slightly before the read deadline expires.
	pingPeriod = (pongWait * 9) / 10

	// Maximum size of an incoming WebSocket message.
	maxMessageSize = 64 * 1024

	// Buffer size for outgoing messages.
	sendBufferSize = 256
)

var upgrader = gws.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,

	// Origin validation should be configured according to the
	// frontend deployment environment.
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")

		// Requests without an Origin header are allowed. This is
		// common for non-browser WebSocket clients.
		if origin == "" {
			return true
		}

		// IMPORTANT:
		// For production, replace this with an explicit allowlist
		// of trusted frontend origins.
		//
		// Example:
		// return origin == "https://your-frontend.example.com"

		return true
	},
}

// Handler handles WebSocket connections.
type Handler struct {
	hub *Hub
}

// NewHandler creates a new WebSocket handler.
func NewHandler(hub *Hub) *Handler {
	return &Handler{
		hub: hub,
	}
}

// Connect upgrades an HTTP connection to a WebSocket connection.
func (h *Handler) Connect(c *gin.Context) {
	if h == nil || h.hub == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "websocket service is not initialized",
		})
		return
	}

	conn, err := upgrader.Upgrade(
		c.Writer,
		c.Request,
		nil,
	)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := &Client{
		Hub:  h.hub,
		Send: make(chan []byte, sendBufferSize),
	}

	// Register the client with the hub.
	h.hub.Register <- client

	// Configure the connection.
	conn.SetReadLimit(maxMessageSize)

	_ = conn.SetReadDeadline(time.Now().Add(pongWait))

	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(
			time.Now().Add(pongWait),
		)
	})

	// Start independent read/write pumps.
	go client.writePump(conn)
	go client.readPump(conn)
}

// readPump reads messages from the WebSocket connection.
//
// The backend currently uses WebSocket primarily for server-side
// event delivery. Incoming client messages are therefore read,
// validated at the transport level, and discarded unless your
// application later defines client-to-server commands.
func (c *Client) readPump(conn *gws.Conn) {
	defer func() {
		c.Hub.Unregister <- c
		_ = conn.Close()
	}()

	conn.SetReadLimit(maxMessageSize)

	_ = conn.SetReadDeadline(time.Now().Add(pongWait))

	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(
			time.Now().Add(pongWait),
		)
	})

	for {
		messageType, _, err := conn.ReadMessage()
		if err != nil {
			// Normal WebSocket closure.
			if gws.IsUnexpectedCloseError(
				err,
				gws.CloseGoingAway,
				gws.CloseNormalClosure,
				gws.CloseNoStatusReceived,
			) {
				log.Printf(
					"WebSocket read error: %v",
					err,
				)
			}

			return
		}

		// The current IBVAP architecture uses the connection
		// for receiving backend events. Ignore client text/binary
		// messages unless a command protocol is introduced.
		switch messageType {
		case gws.TextMessage, gws.BinaryMessage:
			// Intentionally ignored.
			//
			// Do not process arbitrary client messages here.
			// Add explicit command validation if client-to-server
			// communication is required in the future.
		}
	}
}

// writePump sends queued messages to the WebSocket client and
// periodically sends ping frames to keep the connection alive.
func (c *Client) writePump(conn *gws.Conn) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			_ = conn.SetWriteDeadline(
				time.Now().Add(writeWait),
			)

			if !ok {
				// Hub closed the channel.
				_ = conn.WriteMessage(
					gws.CloseMessage,
					[]byte{},
				)
				return
			}

			if err := conn.WriteMessage(
				gws.TextMessage,
				message,
			); err != nil {
				log.Printf(
					"WebSocket write error: %v",
					err,
				)
				return
			}

		case <-ticker.C:
			_ = conn.SetWriteDeadline(
				time.Now().Add(writeWait),
			)

			if err := conn.WriteMessage(
				gws.PingMessage,
				nil,
			); err != nil {
				log.Printf(
					"WebSocket ping failed: %v",
					err,
				)
				return
			}
		}
	}
}