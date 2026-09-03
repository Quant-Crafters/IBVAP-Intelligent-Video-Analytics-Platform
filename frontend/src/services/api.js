const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");
const HEALTH_URL = import.meta.env.VITE_HEALTH_URL || `${API_BASE.replace(/\/api$/, "")}/health`;

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("ibvap_token");

  const headers = new Headers(options.headers || {});

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("ibvap_token");
      localStorage.removeItem("ibvap_user");
    }

    const message =
      data?.error ||
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export function login(credentials) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function register(account) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(account),
  });
}

export async function getHealth() {
  const response = await fetch(HEALTH_URL, {
    headers: { Accept: "application/json" },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error || data?.detail || data?.message || `Health check failed (${response.status}).`
    );
  }

  return data;
}

/* ----------------------------- */
/* Cameras                       */
/* ----------------------------- */

export async function getCameras() {
  const data = await apiRequest("/cameras");
  return Array.isArray(data?.cameras) ? data.cameras : [];
}

/* ----------------------------- */
/* Alerts                        */
/* ----------------------------- */

export async function getAlerts() {
  const data = await apiRequest("/alerts/");
  return Array.isArray(data?.alerts) ? data.alerts : [];
}

export async function getAlert(id) {
  const data = await apiRequest(`/alerts/${id}`);
  return data?.alert || null;
}

/* ----------------------------- */
/* Events                        */
/* ----------------------------- */

export async function getEvents(filters = {}) {
  const params = new URLSearchParams();

  if (filters.camera_id) {
    params.set("camera_id", filters.camera_id);
  }

  if (filters.date) {
    params.set("date", filters.date);
  }

  if (filters.type) {
    params.set("type", filters.type);
  }

  if (filters.severity) {
    params.set("severity", filters.severity);
  }

  const query = params.toString();

  const data = await apiRequest(
    `/events${query ? `?${query}` : ""}`
  );

  return Array.isArray(data?.events) ? data.events : [];
}

/* ----------------------------- */
/* Evidence                      */
/* ----------------------------- */

export async function getEvidence() {
  const data = await apiRequest("/evidence/");
  return Array.isArray(data) ? data : Array.isArray(data?.evidence) ? data.evidence : [];
}

export { apiRequest };
