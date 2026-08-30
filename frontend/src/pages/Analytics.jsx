import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Camera,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import {
  getAlerts,
  getCameras,
  getEvents,
} from "../services/api";

function getCountMap(items, key) {
  return items.reduce((result, item) => {
    const value = item?.[key] || "unknown";

    result[value] = (result[value] || 0) + 1;

    return result;
  }, {});
}

function BarRow({ label, value, max, suffix = "" }) {
  const percentage =
    max > 0 ? Math.max(4, (value / max) * 100) : 0;

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between gap-4">
        <span className="text-xs font-bold text-slate-700">
          {label}
        </span>

        <span className="font-mono text-xs text-slate-500">
          {value}
          {suffix}
        </span>
      </div>

      <div className="h-2 bg-slate-100">
        <div
          className="h-full bg-[#0b192c]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function Analytics() {
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async (manual = false) => {
    try {
      if (manual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [cameraData, alertData, eventData] =
        await Promise.all([
          getCameras(),
          getAlerts(),
          getEvents(),
        ]);

      setCameras(cameraData);
      setAlerts(alertData);
      setEvents(eventData);
    } catch (err) {
      console.error("Analytics error:", err);
      setError(err.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const alertSeverityCounts = useMemo(
    () => getCountMap(alerts, "severity"),
    [alerts]
  );

  const alertTypeCounts = useMemo(
    () => getCountMap(alerts, "type"),
    [alerts]
  );

  const eventTypeCounts = useMemo(
    () => getCountMap(events, "type"),
    [events]
  );

  const cameraEventCounts = useMemo(() => {
    return events.reduce((result, event) => {
      const id = event.camera_id;

      result[id] = (result[id] || 0) + 1;

      return result;
    }, {});
  }, [events]);

  const maxSeverity = Math.max(
    ...Object.values(alertSeverityCounts),
    0
  );

  const maxAlertType = Math.max(
    ...Object.values(alertTypeCounts),
    0
  );

  const maxEventType = Math.max(
    ...Object.values(eventTypeCounts),
    0
  );

  const activeAlerts = alerts.filter(
    (alert) =>
      String(alert.status || "").toLowerCase() === "active"
  ).length;

  const resolvedAlerts = alerts.filter(
    (alert) =>
      String(alert.status || "").toLowerCase() === "resolved"
  ).length;

  const averageConfidence = useMemo(() => {
    const values = alerts
      .map((alert) => Number(alert.confidence))
      .filter((value) => Number.isFinite(value));

    if (!values.length) {
      return null;
    }

    return (
      values.reduce((sum, value) => sum + value, 0) /
      values.length
    );
  }, [alerts]);

  if (loading) {
    return (
      <div className="min-h-full bg-[#f3f5f8]">
        <div className="mx-auto flex min-h-[60vh] w-full max-w-[1360px] items-center justify-center px-4 sm:px-8">
          <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
            <RefreshCw size={18} className="animate-spin" />
            Building analytics from backend data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f3f5f8] text-slate-900">
      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8">

        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-300 pb-5 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BarChart3
                size={15}
                className="text-amber-600"
              />

              <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-amber-700">
                Operational Intelligence
              </span>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-[#0b192c]">
              Analytics
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Operational statistics derived from recorded cameras,
              events and alerts.
            </p>
          </div>

          <button
            onClick={() => loadAnalytics(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 border border-[#0b192c] bg-[#0b192c] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>Backend error:</strong> {error}
          </div>
        )}

        {/* KPI */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <div className="border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Cameras
                </p>

                <p className="mt-3 text-3xl font-black text-[#0b192c]">
                  {cameras.length}
                </p>
              </div>

              <Camera
                size={20}
                className="text-slate-400"
              />
            </div>
          </div>

          <div className="border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Events
                </p>

                <p className="mt-3 text-3xl font-black text-[#0b192c]">
                  {events.length}
                </p>
              </div>

              <Activity
                size={20}
                className="text-slate-400"
              />
            </div>
          </div>

          <div className="border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Alerts
                </p>

                <p className="mt-3 text-3xl font-black text-red-700">
                  {alerts.length}
                </p>
              </div>

              <AlertTriangle
                size={20}
                className="text-red-600"
              />
            </div>
          </div>

          <div className="border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Avg Confidence
                </p>

                <p className="mt-3 text-3xl font-black text-[#0b192c]">
                  {averageConfidence === null
                    ? "—"
                    : `${(averageConfidence * 100).toFixed(1)}%`}
                </p>
              </div>

              <ShieldAlert
                size={20}
                className="text-slate-400"
              />
            </div>
          </div>

        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">

          <section className="border border-slate-300 bg-white p-5 shadow-sm">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h2 className="font-black text-[#0b192c]">
                Alerts by Severity
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Distribution from actual alert records.
              </p>
            </div>

            {Object.keys(alertSeverityCounts).length === 0 ? (
              <p className="text-sm text-slate-500">
                No alert data available.
              </p>
            ) : (
              Object.entries(alertSeverityCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([severity, count]) => (
                  <BarRow
                    key={severity}
                    label={severity}
                    value={count}
                    max={maxSeverity}
                  />
                ))
            )}
          </section>

          <section className="border border-slate-300 bg-white p-5 shadow-sm">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h2 className="font-black text-[#0b192c]">
                Alert Types
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Most frequently recorded threat types.
              </p>
            </div>

            {Object.keys(alertTypeCounts).length === 0 ? (
              <p className="text-sm text-slate-500">
                No alert data available.
              </p>
            ) : (
              Object.entries(alertTypeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <BarRow
                    key={type}
                    label={type}
                    value={count}
                    max={maxAlertType}
                  />
                ))
            )}
          </section>

          <section className="border border-slate-300 bg-white p-5 shadow-sm">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h2 className="font-black text-[#0b192c]">
                Events by Type
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Event distribution from the event registry.
              </p>
            </div>

            {Object.keys(eventTypeCounts).length === 0 ? (
              <p className="text-sm text-slate-500">
                No event data available.
              </p>
            ) : (
              Object.entries(eventTypeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <BarRow
                    key={type}
                    label={type}
                    value={count}
                    max={maxEventType}
                  />
                ))
            )}
          </section>

          <section className="border border-slate-300 bg-white p-5 shadow-sm">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h2 className="font-black text-[#0b192c]">
                Alert Resolution
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Current alert status distribution.
              </p>
            </div>

            <BarRow
              label="Active"
              value={activeAlerts}
              max={Math.max(
                activeAlerts,
                resolvedAlerts,
                1
              )}
            />

            <BarRow
              label="Resolved"
              value={resolvedAlerts}
              max={Math.max(
                activeAlerts,
                resolvedAlerts,
                1
              )}
            />
          </section>

        </div>

        {/* Camera activity */}
        <section className="mt-6 border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-black text-[#0b192c]">
              Camera Event Activity
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Event volume grouped by camera ID.
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {cameras.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                No camera data available.
              </div>
            ) : (
              cameras.map((camera) => (
                <div
                  key={camera.id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div>
                    <p className="font-bold text-[#0b192c]">
                      {camera.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {camera.location}
                    </p>
                  </div>

                  <span className="font-mono text-sm font-bold text-slate-700">
                    {cameraEventCounts[camera.id] || 0} events
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}