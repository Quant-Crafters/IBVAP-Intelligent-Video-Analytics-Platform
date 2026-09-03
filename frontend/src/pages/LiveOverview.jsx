import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getAlerts,
  getCameras,
  getEvents,
} from "../services/api";


/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  const isOnline =
    normalized === "online" ||
    normalized === "active" ||
    normalized === "running";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
        isOnline
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isOnline
            ? "bg-emerald-500 animate-pulse"
            : "bg-slate-400"
        }`}
      />

      {status || "unknown"}
    </span>
  );
}


/* =========================================================
   SEVERITY BADGE
========================================================= */

function SeverityBadge({ severity }) {
  const value = String(severity || "").toLowerCase();

  const classes = {
    critical:
      "border-red-200 bg-red-50 text-red-700",

    high:
      "border-orange-200 bg-orange-50 text-orange-700",

    medium:
      "border-amber-200 bg-amber-50 text-amber-700",

    low:
      "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
        classes[value] ||
        "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {severity || "unknown"}
    </span>
  );
}


/* =========================================================
   DATE FORMATTER
========================================================= */

function formatTimestamp(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}


/* =========================================================
   KPI CARD
========================================================= */

function KpiCard({
  label,
  value,
  description,
  theme,
  delay,
}) {
  const themes = {
    navy: {
      wrapper:
        "border-slate-200 bg-gradient-to-br from-white via-white to-slate-100",
      value: "text-[#0b192c]",
      accent:
        "from-slate-500 via-slate-700 to-slate-400",
      glow:
        "hover:shadow-[0_16px_35px_rgba(15,23,42,0.10)]",
    },

    green: {
      wrapper:
        "border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50",
      value: "text-emerald-600",
      accent:
        "from-emerald-400 via-emerald-500 to-teal-300",
      glow:
        "hover:shadow-[0_16px_35px_rgba(16,185,129,0.13)]",
    },

    red: {
      wrapper:
        "border-red-100 bg-gradient-to-br from-white via-white to-red-50",
      value: "text-red-600",
      accent:
        "from-red-400 via-red-500 to-orange-300",
      glow:
        "hover:shadow-[0_16px_35px_rgba(239,68,68,0.13)]",
    },

    amber: {
      wrapper:
        "border-amber-100 bg-gradient-to-br from-white via-white to-amber-50",
      value: "text-amber-600",
      accent:
        "from-amber-400 via-orange-400 to-yellow-300",
      glow:
        "hover:shadow-[0_16px_35px_rgba(245,158,11,0.13)]",
    },
  };

  const current =
    themes[theme] || themes.navy;

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border p-5",
        "shadow-[0_4px_16px_rgba(7,20,38,0.05)]",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1",
        current.wrapper,
        current.glow,
        "animate-[fadeUp_0.55s_ease-out_forwards]",
        "opacity-0",
      ].join(" ")}
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      {/* TOP ACCENT */}
      <div
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${current.accent}`}
      />

      {/* SOFT HOVER GLOW */}
      <div
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${current.accent} opacity-[0.06] blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-[0.12]`}
      />

      <div className="relative">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>

        <p
          className={`mt-2 text-4xl font-black tracking-[-0.04em] ${current.value}`}
        >
          {value}
        </p>

        <p className="mt-1.5 text-[10px] font-medium text-slate-400">
          {description}
        </p>
      </div>

      {/* BOTTOM ANIMATION */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
        <div
          className={`h-full w-1/3 animate-[slideAccent_3s_ease-in-out_infinite] bg-gradient-to-r ${current.accent} opacity-70`}
        />
      </div>
    </div>
  );
}



/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function LiveOverview() {
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");


  /* =======================================================
     LOAD BACKEND DATA
  ======================================================= */

  const loadData = useCallback(
    async (manual = false, isInitial = false) => {
      try {
        if (manual) {
          setRefreshing(true);
        } else if (isInitial) {
          setLoading(true);
        }

        setError("");

        const [
          cameraData,
          alertData,
          eventData,
        ] = await Promise.all([
          getCameras(),
          getAlerts(),
          getEvents(),
        ]);

        setCameras(
          Array.isArray(cameraData)
            ? cameraData
            : []
        );

        setAlerts(
          Array.isArray(alertData)
            ? alertData
            : []
        );

        setEvents(
          Array.isArray(eventData)
            ? eventData
            : []
        );
      } catch (err) {
        console.error(
          "Live Overview backend error:",
          err
        );

        setError(
          err?.message ||
            "Unable to connect to the IBVAP backend."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );


  /* =======================================================
     INITIAL LOAD + AUTO REFRESH
  ======================================================= */

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadData(false, true), 0);

    const interval = setInterval(() => {
      loadData(false, false);
    }, 5000);

    return () => {
      window.clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadData]);


  /* =======================================================
     ONLINE CAMERAS
  ======================================================= */

  const onlineCameras = useMemo(() => {
    return cameras.filter((camera) => {
      const status = String(camera?.status || "").toLowerCase();
      return (
        status === "online" ||
        status === "active" ||
        status === "running"
      );
    }).length;
  }, [cameras]);

  const activeAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const st = String(alert?.status || "").toLowerCase();
      return st === "active" || st === "new" || st === "escalated";
    });
  }, [alerts]);

  const recentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const timeA = new Date(
          a?.timestamp
        ).getTime();

        const timeB = new Date(
          b?.timestamp
        ).getTime();

        return timeB - timeA;
      })
      .slice(0, 8);
  }, [events]);


  /* =======================================================
     INITIAL LOADING SCREEN
  ======================================================= */

  if (loading) {
    return (
      <>
        <div className="min-h-[calc(100vh-80px)] bg-[#f3f5f8]">

          <div className="flex min-h-[60vh] items-center justify-center">

            <div className="text-center">

              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#0b192c]" />

              <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Loading live surveillance data...
              </p>

            </div>

          </div>

        </div>

        <style>
          {`
            @keyframes fadeUp {
              from {
                opacity: 0;
                transform: translateY(14px);
              }

              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes slideAccent {
              0% {
                transform: translateX(-180%);
              }

              50% {
                transform: translateX(180%);
              }

              100% {
                transform: translateX(420%);
              }
            }
          `}
        </style>
      </>
    );
  }


  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <>
      <div className="min-h-[calc(100vh-80px)] bg-[#f3f5f8] text-slate-900">

        <div className="mx-auto max-w-[1600px] p-5 sm:p-6 lg:p-8">

          {/* =================================================
              HEADER
          ================================================= */}

          <div className="mb-7 flex flex-col gap-5 border-b border-slate-300 pb-6 md:flex-row md:items-end md:justify-between">

            <div>

              <div className="mb-2 flex items-center gap-2">



              </div>

              <h1 className="text-3xl font-black tracking-[-0.03em] text-[#0b192c] lg:text-4xl">
                Live Overview
              </h1>

              <p className="mt-1.5 text-xs font-medium text-slate-400">
                Real-time surveillance status from the IBVAP backend.
              </p>

            </div>


            {/* REFRESH */}

            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="rounded-lg border border-[#0b192c] bg-[#0b192c] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

          </div>


          {/* =================================================
              BACKEND ERROR
          ================================================= */}

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 shadow-sm">

              <strong>
                Backend connection error:
              </strong>{" "}

              {error}

            </div>
          )}


          {/* =================================================
              KPI CARDS
          ================================================= */}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <KpiCard
              label="Total Cameras"
              value={cameras.length}
              description="Registered in system"
              theme="navy"
              delay={0}
            />

            <KpiCard
              label="Cameras Online"
              value={onlineCameras}
              description="Live and reachable"
              theme="green"
              delay={80}
            />

            <KpiCard
              label="Active Threat Alerts"
              value={activeAlerts.length}
              description="Currently active"
              theme="red"
              delay={160}
            />

            <KpiCard
              label="Recorded Events"
              value={events.length}
              description="Stored by backend"
              theme="amber"
              delay={240}
            />

          </div>


          {/* =================================================
              CAMERA + ALERTS
          ================================================= */}

          <div className="mt-7 grid gap-6 xl:grid-cols-[1.4fr_1fr]">


            {/* =================================================
                CAMERA NETWORK
            ================================================= */}

            <section
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(7,20,38,0.05)] animate-[fadeUp_0.6s_ease-out_forwards] opacity-0"
              style={{
                animationDelay: "280ms",
              }}
            >

              <div className="border-b border-slate-200 px-5 py-5">

                <div className="flex items-center justify-between">

                  <div>

                    <h2 className="text-base font-black tracking-tight text-[#0b192c]">
                      Camera Network
                    </h2>

                    <p className="mt-1 text-[10px] text-slate-400">
                      Current camera status reported by the backend.
                    </p>

                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {cameras.length} Total
                  </span>

                </div>

              </div>


              <div className="divide-y divide-slate-100">

                {cameras.length === 0 ? (

                  <div className="px-5 py-12 text-center">

                    <p className="text-sm font-bold text-slate-700">
                      No cameras registered
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      The backend currently has no camera records.
                    </p>

                  </div>

                ) : (

                  cameras.map((camera) => (

                    <div
                      key={camera.id}
                      className="group flex flex-col gap-3 px-5 py-4 transition-colors duration-200 hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
                    >

                      <div className="min-w-0">

                        <p className="truncate text-sm font-bold text-[#0b192c]">
                          {camera.name ||
                            `Camera #${camera.id}`}
                        </p>

                        <p className="mt-1 truncate text-[10px] text-slate-400">
                          {camera.location ||
                            "Location unavailable"}
                        </p>

                      </div>

                      <StatusBadge
                        status={camera.status}
                      />

                    </div>

                  ))

                )}

              </div>

            </section>


            {/* =================================================
                ACTIVE ALERTS
            ================================================= */}

            <section
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(7,20,38,0.05)] animate-[fadeUp_0.6s_ease-out_forwards] opacity-0"
              style={{
                animationDelay: "360ms",
              }}
            >

              <div className="border-b border-slate-200 px-5 py-5">

                <div className="flex items-center justify-between">

                  <div>

                    <h2 className="text-base font-black tracking-tight text-[#0b192c]">
                      Active Threat Alerts
                    </h2>

                    <p className="mt-1 text-[10px] text-slate-400">
                      Alerts currently marked active.
                    </p>

                  </div>

                  <span
                    className={`rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] ${
                      activeAlerts.length > 0
                        ? "bg-red-50 text-red-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {activeAlerts.length} Active
                  </span>

                </div>

              </div>


              <div className="divide-y divide-slate-100">

                {activeAlerts.length === 0 ? (

                  <div className="px-5 py-12 text-center">

                    <p className="text-sm font-bold text-slate-700">
                      No active alerts
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      The backend currently reports no active threats.
                    </p>

                  </div>

                ) : (

                  activeAlerts
                    .slice(0, 6)
                    .map((alert) => (

                      <div
                        key={alert.id}
                        className="group px-5 py-4 transition-colors duration-200 hover:bg-red-50/30"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div className="min-w-0">

                            <p className="truncate text-sm font-bold text-[#0b192c]">
                              {alert.type ||
                                "Unknown Alert"}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-400">
                              Camera #{alert.camera_id}
                            </p>

                          </div>

                          <SeverityBadge
                            severity={
                              alert.severity
                            }
                          />

                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">

                          <p className="text-[9px] font-mono text-slate-400">
                            {formatTimestamp(
                              alert.timestamp
                            )}
                          </p>

                          <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-red-500">
                            Active
                          </span>

                        </div>

                      </div>

                    ))

                )}

              </div>

            </section>

          </div>


          {/* =================================================
              RECENT EVENTS
          ================================================= */}

          <section
            className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(7,20,38,0.05)] animate-[fadeUp_0.6s_ease-out_forwards] opacity-0"
            style={{
              animationDelay: "440ms",
            }}
          >

            <div className="border-b border-slate-200 px-5 py-5">

              <h2 className="text-base font-black tracking-tight text-[#0b192c]">
                Recent Events
              </h2>

              <p className="mt-1 text-[10px] text-slate-400">
                Latest events recorded by the IBVAP backend.
              </p>

            </div>


            <div className="overflow-x-auto">

              {recentEvents.length === 0 ? (

                <div className="px-5 py-12 text-center">

                  <p className="text-sm font-bold text-slate-700">
                    No events recorded
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    The backend currently has no event records.
                  </p>

                </div>

              ) : (

                <table className="w-full min-w-[800px]">

                  <thead className="bg-[#f8fafc]">

                    <tr className="border-b border-slate-200 text-left">

                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Type
                      </th>

                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Camera
                      </th>

                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Severity
                      </th>

                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Message
                      </th>

                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Time
                      </th>

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-slate-100">

                    {recentEvents.map((event) => (

                      <tr
                        key={event.id}
                        className="transition-colors duration-150 hover:bg-slate-50"
                      >

                        <td className="px-5 py-4 text-sm font-bold text-[#0b192c]">
                          {event.type ||
                            "Unknown"}
                        </td>

                        <td className="px-5 py-4 text-xs font-semibold text-slate-500">
                          #{event.camera_id}
                        </td>

                        <td className="px-5 py-4">
                          <SeverityBadge
                            severity={
                              event.severity
                            }
                          />
                        </td>

                        <td className="max-w-sm px-5 py-4 text-xs leading-5 text-slate-500">
                          {event.message ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 text-[10px] font-mono text-slate-400">
                          {formatTimestamp(
                            event.timestamp
                          )}
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


      {/* ========================================================
          ANIMATIONS
      ========================================================= */}

      <style>
        {`
          @keyframes fadeUp {
            from {
              opacity: 0;
              transform: translateY(14px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes slideAccent {
            0% {
              transform: translateX(-180%);
            }

            50% {
              transform: translateX(180%);
            }

            100% {
              transform: translateX(420%);
            }
          }
        `}
      </style>
    </>
  );
}
