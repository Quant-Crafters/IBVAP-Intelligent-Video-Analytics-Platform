import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  FileText,
  Printer,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  getAlerts,
  getCameras,
  getEvents,
} from "../services/api";

function formatTimestamp(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

export default function Reports() {
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadReportData = useCallback(async (manual = false) => {
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
      console.error("Reports error:", err);
      setError(
        err.message || "Failed to load report data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const activeAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          String(alert.status || "").toLowerCase() ===
          "active"
      ),
    [alerts]
  );

  const criticalAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          String(alert.severity || "").toLowerCase() ===
          "critical"
      ),
    [alerts]
  );

  const highAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          String(alert.severity || "").toLowerCase() ===
          "high"
      ),
    [alerts]
  );

  const latestAlerts = useMemo(() => {
    return [...alerts]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime()
      )
      .slice(0, 10);
  }, [alerts]);

  const reportDate = new Date().toLocaleString();

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#f3f5f8]">
        <div className="mx-auto flex min-h-[60vh] w-full max-w-[1360px] items-center justify-center px-4 sm:px-8">
          <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
            <RefreshCw size={18} className="animate-spin" />
            Preparing operational report...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f3f5f8] text-slate-900">
      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8 print:max-w-none print:px-0 print:py-0">

        {/* Screen header */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-300 pb-5 md:flex-row md:items-end print:hidden">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FileText
                size={15}
                className="text-amber-600"
              />

              <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-amber-700">
                Operational Reporting
              </span>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-[#0b192c]">
              Reports
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Report generated from the current backend
              surveillance data.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => loadReportData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 border border-slate-300 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#0b192c] hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                size={15}
                className={
                  refreshing ? "animate-spin" : ""
                }
              />
              Refresh
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 border border-[#0b192c] bg-[#0b192c] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800"
            >
              <Printer size={15} />
              Print Report
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
            <strong>Backend error:</strong> {error}
          </div>
        )}

        {/* Report document */}
        <div className="border border-slate-300 bg-white shadow-sm print:border-0 print:shadow-none">

          {/* Report header */}
          <div className="border-b-2 border-[#0b192c] bg-[#0b192c] px-6 py-6 text-white sm:px-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row">
              <div>
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-amber-400">
                  Government of India • Ministry of Defence
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  IBVAP Operational Surveillance Report
                </h2>

                <p className="mt-2 text-xs text-slate-300">
                  Intelligent Border Video Analytics Platform
                </p>
              </div>

              <div className="sm:text-right">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Generated
                </p>

                <p className="mt-1 text-xs font-mono text-white">
                  {reportDate}
                </p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid gap-px bg-slate-300 md:grid-cols-4">

            <div className="bg-white p-5">
              <div className="flex items-center gap-3">
                <Activity
                  size={18}
                  className="text-[#0b192c]"
                />

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Cameras
                  </p>

                  <p className="mt-1 text-2xl font-black text-[#0b192c]">
                    {cameras.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5">
              <div className="flex items-center gap-3">
                <Activity
                  size={18}
                  className="text-[#0b192c]"
                />

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Events
                  </p>

                  <p className="mt-1 text-2xl font-black text-[#0b192c]">
                    {events.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle
                  size={18}
                  className="text-red-600"
                />

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Active Alerts
                  </p>

                  <p className="mt-1 text-2xl font-black text-red-700">
                    {activeAlerts.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck
                  size={18}
                  className="text-green-600"
                />

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Critical
                  </p>

                  <p className="mt-1 text-2xl font-black text-orange-700">
                    {criticalAlerts.length}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Operational summary */}
          <section className="p-6 sm:p-8">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <CalendarDays
                size={17}
                className="text-slate-500"
              />

              <h3 className="font-black text-[#0b192c]">
                Operational Summary
              </h3>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">

              <div className="border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Total Alerts
                </p>

                <p className="mt-2 text-xl font-black text-[#0b192c]">
                  {alerts.length}
                </p>
              </div>

              <div className="border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  High Severity
                </p>

                <p className="mt-2 text-xl font-black text-orange-700">
                  {highAlerts.length}
                </p>
              </div>

              <div className="border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Recorded Events
                </p>

                <p className="mt-2 text-xl font-black text-[#0b192c]">
                  {events.length}
                </p>
              </div>

            </div>
          </section>

          {/* Recent alerts */}
          <section className="px-6 pb-8 sm:px-8">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="font-black text-[#0b192c]">
                Recent Alerts
              </h3>
            </div>

            <div className="mt-4 overflow-x-auto">
              {latestAlerts.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No alerts recorded in the backend.
                </p>
              ) : (
                <table className="w-full min-w-[700px]">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Type
                      </th>

                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Camera
                      </th>

                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Severity
                      </th>

                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Status
                      </th>

                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Timestamp
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {latestAlerts.map((alert) => (
                      <tr key={alert.id}>
                        <td className="px-4 py-3 text-sm font-bold text-[#0b192c]">
                          {alert.type}
                        </td>

                        <td className="px-4 py-3 text-sm text-slate-600">
                          #{alert.camera_id}
                        </td>

                        <td className="px-4 py-3 text-xs font-bold uppercase text-slate-700">
                          {alert.severity}
                        </td>

                        <td className="px-4 py-3 text-xs font-bold uppercase text-slate-700">
                          {String(
                            alert.status || ""
                          ).replace("_", " ")}
                        </td>

                        <td className="px-4 py-3 text-xs font-mono text-slate-500">
                          {formatTimestamp(
                            alert.timestamp
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Footer */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-center sm:px-8">
            <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
              IBVAP • Operational Surveillance System •
              Generated from backend data
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}