import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { getAlerts } from "../services/api";

function SeverityBadge({ severity }) {
  const value = String(severity || "").toLowerCase();

  const classes = {
    critical: "border-red-300 bg-red-50 text-red-700",
    high: "border-orange-300 bg-orange-50 text-orange-700",
    medium: "border-amber-300 bg-amber-50 text-amber-700",
    low: "border-blue-300 bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
        classes[value] ||
        "border-slate-300 bg-slate-50 text-slate-600"
      }`}
    >
      {severity || "unknown"}
    </span>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "").toLowerCase();

  const classes = {
    active: "border-red-300 bg-red-50 text-red-700",
    acknowledged: "border-blue-300 bg-blue-50 text-blue-700",
    escalated: "border-orange-300 bg-orange-50 text-orange-700",
    false_alert: "border-slate-300 bg-slate-50 text-slate-600",
    resolved: "border-green-300 bg-green-50 text-green-700",
  };

  return (
    <span
      className={`inline-flex border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
        classes[value] ||
        "border-slate-300 bg-slate-50 text-slate-600"
      }`}
    >
      {(status || "unknown").replace("_", " ")}
    </span>
  );
}

function formatTimestamp(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

export default function ThreatAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadAlerts = useCallback(async (manual = false) => {
    try {
      if (manual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const data = await getAlerts();

      setAlerts(data);
    } catch (err) {
      console.error("Threat Alerts error:", err);
      setError(err.message || "Failed to load alerts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();

    const interval = setInterval(() => {
      loadAlerts(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadAlerts]);

  const filteredAlerts = useMemo(() => {
    return [...alerts]
      .filter((alert) => {
        const severityMatch =
          severityFilter === "all" ||
          String(alert.severity || "").toLowerCase() ===
            severityFilter;

        const statusMatch =
          statusFilter === "all" ||
          String(alert.status || "").toLowerCase() ===
            statusFilter;

        return severityMatch && statusMatch;
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime()
      );
  }, [alerts, severityFilter, statusFilter]);

  const activeCount = alerts.filter(
    (a) =>
      String(a.status || "").toLowerCase() === "active"
  ).length;

  const criticalCount = alerts.filter(
    (a) =>
      String(a.severity || "").toLowerCase() === "critical"
  ).length;

  const escalatedCount = alerts.filter(
    (a) =>
      String(a.status || "").toLowerCase() === "escalated"
  ).length;

  if (loading) {
    return (
      <div className="min-h-full bg-[#f3f5f8]">
        <div className="mx-auto flex min-h-[60vh] w-full max-w-[1360px] items-center justify-center px-4 sm:px-8">
          <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
            <RefreshCw size={18} className="animate-spin" />
            Loading threat alerts...
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
              <ShieldAlert
                size={15}
                className="text-red-600"
              />

              <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-red-700">
                Threat Management
              </span>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-[#0b192c]">
              Threat Alerts
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Review alerts generated and stored by the
              surveillance backend.
            </p>
          </div>

          <button
            onClick={() => loadAlerts(true)}
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

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">

          <div className="border border-red-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Active Alerts
            </p>

            <p className="mt-3 text-3xl font-black text-red-700">
              {activeCount}
            </p>
          </div>

          <div className="border border-orange-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Critical Alerts
            </p>

            <p className="mt-3 text-3xl font-black text-orange-700">
              {criticalCount}
            </p>
          </div>

          <div className="border border-slate-300 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Escalated
            </p>

            <p className="mt-3 text-3xl font-black text-[#0b192c]">
              {escalatedCount}
            </p>
          </div>

        </div>

        {/* Filters */}
        <div className="mt-6 border border-slate-300 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Severity
              </label>

              <select
                value={severityFilter}
                onChange={(e) =>
                  setSeverityFilter(e.target.value)
                }
                className="w-full border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#0b192c]"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="w-full border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#0b192c]"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="acknowledged">
                  Acknowledged
                </option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
                <option value="false_alert">
                  False Alert
                </option>
              </select>
            </div>

          </div>
        </div>

        {/* Alert table */}
        <section className="mt-6 border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-black text-[#0b192c]">
              Alert Registry
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {filteredAlerts.length} alert
              {filteredAlerts.length === 1 ? "" : "s"} matching
              current filters.
            </p>
          </div>

          <div className="overflow-x-auto">
            {filteredAlerts.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <CheckCircle2
                  size={34}
                  className="mx-auto text-green-600"
                />

                <p className="mt-3 font-bold text-slate-700">
                  No matching alerts
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Alert
                    </th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Camera
                    </th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Severity
                    </th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Confidence
                    </th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Timestamp
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {filteredAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="border border-red-200 bg-red-50 p-2">
                            <AlertTriangle
                              size={15}
                              className="text-red-600"
                            />
                          </div>

                          <div>
                            <p className="font-bold text-[#0b192c]">
                              {alert.type}
                            </p>

                            {alert.evidence && (
                              <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                                {alert.evidence}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        Camera #{alert.camera_id}
                      </td>

                      <td className="px-5 py-4">
                        <SeverityBadge
                          severity={alert.severity}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-mono text-sm text-slate-700">
                          {typeof alert.confidence === "number"
                            ? `${(
                                alert.confidence * 100
                              ).toFixed(1)}%`
                            : "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={alert.status} />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock3 size={13} />
                          {formatTimestamp(alert.timestamp)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}