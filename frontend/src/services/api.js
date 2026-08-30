const API_BASE = "/api";

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("ibvap_token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
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
  return Array.isArray(data?.evidence) ? data.evidence : [];
}

export { apiRequest };