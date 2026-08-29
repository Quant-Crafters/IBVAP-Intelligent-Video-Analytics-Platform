package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

// Client represents a connected WebSocket client.
type Client struct {
	Hub  *Hub
	Send chan []byte
}

// Hub manages all active WebSocket clients and broadcasts events.
type Hub struct {
	// Registered clients.
	clients map[*Client]bool

	// Register requests from clients.
	Register chan *Client

	// Unregister requests from clients.
	Unregister chan *Client

	// Broadcast messages to all connected clients.
	Broadcast chan []byte

	// Protects access to clients.
	mu sync.RWMutex
}

// NewHub creates and initializes a new WebSocket hub.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan []byte),
	}
}

// Run starts the WebSocket hub event loop.
//
// This method should normally be started as a goroutine:
//
//	go hub.Run()
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.registerClient(client)

		case client := <-h.Unregister:
			h.unregisterClient(client)

		case message := <-h.Broadcast:
			h.broadcastMessage(message)
		}
	}
}

// registerClient adds a client to the hub.
func (h *Hub) registerClient(client *Client) {
	if client == nil {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// Prevent duplicate registration.
	if h.clients[client] {
		return
	}

	h.clients[client] = true

	log.Printf(
		"WebSocket client connected. Active clients: %d",
		len(h.clients),
	)
}

// unregisterClient removes a client from the hub.
func (h *Hub) unregisterClient(client *Client) {
	if client == nil {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.clients[client]; !exists {
		return
	}

	delete(h.clients, client)

	// Close the client's send channel.
	// The write pump should exit when this channel is closed.
	close(client.Send)

	log.Printf(
		"WebSocket client disconnected. Active clients: %d",
		len(h.clients),
	)
}

// broadcastMessage sends a message to all currently connected clients.
func (h *Hub) broadcastMessage(message []byte) {
	if len(message) == 0 {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.Send <- message:
			// Message successfully queued.
		default:
			// Client is not consuming messages fast enough.
			//
			// Do not block the entire hub because of one
			// slow client.
			log.Printf("WebSocket client send buffer full; dropping message")
		}
	}
}

// BroadcastJSON serializes the supplied value and broadcasts it
// to all connected WebSocket clients.
func (h *Hub) BroadcastJSON(value interface{}) error {
	message, err := json.Marshal(value)
	if err != nil {
		return err
	}

	h.Broadcast <- message

	return nil
}

// ClientCount returns the number of currently connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return len(h.clients)
}

// AddClient registers a client with the hub.
func (h *Hub) AddClient(client *Client) {
	if client == nil {
		return
	}

	h.Register <- client
}

// RemoveClient unregisters a client from the hub.
func (h *Hub) RemoveClient(client *Client) {
	if client == nil {
		return
	}

	h.Unregister <- client
}