import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getAlerts,
  getCameras,
  getEvents,
} from "../services/api";


/* =========================================================
   COUNT MAP
========================================================= */

function getCountMap(items, key) {
  return items.reduce((result, item) => {
    const value = item?.[key] || "unknown";

    result[value] = (result[value] || 0) + 1;

    return result;
  }, {});
}


/* =========================================================
   ANIMATED BAR ROW
========================================================= */

function BarRow({
  label,
  value,
  max,
  tone = "navy",
  delay = 0,
}) {
  const percentage =
    max > 0
      ? Math.max(4, (value / max) * 100)
      : 0;

  const barColors = {
    navy:
      "from-[#071426] via-[#1c3858] to-[#496986]",

    green:
      "from-emerald-500 via-emerald-400 to-teal-300",

    red:
      "from-red-500 via-red-400 to-orange-300",

    amber:
      "from-amber-500 via-orange-400 to-yellow-300",

    blue:
      "from-blue-500 via-blue-400 to-cyan-300",
  };

  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="min-w-0 truncate text-xs font-bold text-slate-700">
          {label}
        </span>

        <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-400">
          {value}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            barColors[tone] || barColors.navy
          } animate-[barGrow_0.9s_ease-out_forwards]`}
          style={{
            width: `${percentage}%`,
            animationDelay: `${delay}ms`,
            transformOrigin: "left",
          }}
        />
      </div>
    </div>
  );
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
      value: "text-[#071426]",
      accent:
        "from-slate-500 via-slate-700 to-slate-400",
      glow:
        "hover:shadow-[0_18px_38px_rgba(15,23,42,0.11)]",
    },

    green: {
      wrapper:
        "border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50",
      value: "text-emerald-600",
      accent:
        "from-emerald-400 via-emerald-500 to-teal-300",
      glow:
        "hover:shadow-[0_18px_38px_rgba(16,185,129,0.13)]",
    },

    red: {
      wrapper:
        "border-red-100 bg-gradient-to-br from-white via-white to-red-50",
      value: "text-red-600",
      accent:
        "from-red-400 via-red-500 to-orange-300",
      glow:
        "hover:shadow-[0_18px_38px_rgba(239,68,68,0.13)]",
    },

    amber: {
      wrapper:
        "border-amber-100 bg-gradient-to-br from-white via-white to-amber-50",
      value: "text-amber-600",
      accent:
        "from-amber-400 via-orange-400 to-yellow-300",
      glow:
        "hover:shadow-[0_18px_38px_rgba(245,158,11,0.13)]",
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

      {/* SOFT GLOW */}
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

      {/* MOVING ACCENT */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
        <div
          className={`h-full w-1/3 animate-[slideAccent_3s_ease-in-out_infinite] bg-gradient-to-r ${current.accent} opacity-70`}
        />
      </div>
    </div>
  );
}


/* =========================================================
   SECTION WRAPPER
========================================================= */

function AnalyticsSection({
  title,
  description,
  children,
  delay = 0,
  className = "",
}) {
  return (
    <section
      className={[
        "overflow-hidden rounded-2xl border border-slate-200",
        "bg-white shadow-[0_4px_16px_rgba(7,20,38,0.05)]",
        "animate-[fadeUp_0.6s_ease-out_forwards] opacity-0",
        className,
      ].join(" ")}
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="border-b border-slate-200 px-5 py-5">
        <h2 className="text-base font-black tracking-tight text-[#0b192c]">
          {title}
        </h2>

        <p className="mt-1 text-[10px] leading-5 text-slate-400">
          {description}
        </p>
      </div>

      <div className="p-5">
        {children}
      </div>
    </section>
  );
}


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Analytics() {
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");


  /* =======================================================
     LOAD ANALYTICS
  ======================================================= */

  const loadAnalytics = useCallback(
    async (manual = false) => {
      try {
        if (manual) {
          setRefreshing(true);
        } else {
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
          "Analytics error:",
          err
        );

        setError(
          err?.message ||
            "Failed to load analytics."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );


  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadAnalytics(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadAnalytics]);


  /* =======================================================
     ANALYTICS DATA
  ======================================================= */

  const alertSeverityCounts =
    useMemo(
      () =>
        getCountMap(
          alerts,
          "severity"
        ),
      [alerts]
    );

  const alertTypeCounts =
    useMemo(
      () =>
        getCountMap(
          alerts,
          "type"
        ),
      [alerts]
    );

  const eventTypeCounts =
    useMemo(
      () =>
        getCountMap(
          events,
          "type"
        ),
      [events]
    );

  const cameraEventCounts =
    useMemo(() => {
      return events.reduce(
        (result, event) => {
          const id =
            event.camera_id;

          result[id] =
            (result[id] || 0) + 1;

          return result;
        },
        {}
      );
    }, [events]);


  const maxSeverity =
    Math.max(
      ...Object.values(
        alertSeverityCounts
      ),
      0
    );

  const maxAlertType =
    Math.max(
      ...Object.values(
        alertTypeCounts
      ),
      0
    );

  const maxEventType =
    Math.max(
      ...Object.values(
        eventTypeCounts
      ),
      0
    );


  const activeAlerts =
    alerts.filter(
      (alert) =>
        String(
          alert.status || ""
        ).toLowerCase() ===
        "active"
    ).length;


  const resolvedAlerts =
    alerts.filter(
      (alert) =>
        String(
          alert.status || ""
        ).toLowerCase() ===
        "resolved"
    ).length;


  const averageConfidence =
    useMemo(() => {
      const values = alerts
        .map((alert) =>
          Number(
            alert.confidence
          )
        )
        .filter((value) =>
          Number.isFinite(value)
        );

      if (!values.length) {
        return null;
      }

      return (
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / values.length
      );
    }, [alerts]);


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <>
        <div className="min-h-full bg-[#f3f5f8]">
          <div className="mx-auto flex min-h-[60vh] w-full max-w-[1360px] items-center justify-center px-4 sm:px-8">

            <div className="text-center">

              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#071426]" />

              <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Building analytics
              </p>

              <p className="mt-2 text-[10px] text-slate-400">
                Processing current camera, event and alert data...
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

            @keyframes barGrow {
              from {
                transform: scaleX(0);
                opacity: 0.4;
              }

              to {
                transform: scaleX(1);
                opacity: 1;
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
      <div className="min-h-full bg-[#f3f5f8] text-slate-900">

        <div className="mx-auto w-full max-w-[1500px] px-5 py-7 sm:px-7 lg:px-8">

          {/* =================================================
              HEADER
          ================================================== */}

          <div className="mb-7 flex flex-col gap-5 border-b border-slate-300 pb-6 md:flex-row md:items-end md:justify-between">

            <div>

              <div className="mb-2 flex items-center gap-2">



              </div>

              <h1 className="text-3xl font-black tracking-[-0.03em] text-[#0b192c] lg:text-4xl">
                Analytics
              </h1>

              <p className="mt-1.5 text-xs font-medium text-slate-400">
                Operational statistics derived from recorded cameras, events and alerts.
              </p>

            </div>


            <button
              type="button"
              onClick={() =>
                loadAnalytics(true)
              }
              disabled={refreshing}
              className="rounded-lg border border-[#0b192c] bg-[#0b192c] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

          </div>


          {/* =================================================
              ERROR
          ================================================== */}

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 shadow-sm">

              <strong>
                Backend error:
              </strong>{" "}

              {error}

            </div>
          )}


          {/* =================================================
              KPI CARDS
          ================================================== */}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <KpiCard
              label="Cameras"
              value={cameras.length}
              description="Registered in system"
              theme="navy"
              delay={0}
            />

            <KpiCard
              label="Events"
              value={events.length}
              description="Recorded event activity"
              theme="green"
              delay={80}
            />

            <KpiCard
              label="Alerts"
              value={alerts.length}
              description="Total recorded alerts"
              theme="red"
              delay={160}
            />

            <KpiCard
              label="Avg Confidence"
              value={
                averageConfidence === null
                  ? "—"
                  : `${(
                      averageConfidence * 100
                    ).toFixed(1)}%`
              }
              description="Across available alert records"
              theme="amber"
              delay={240}
            />

          </div>


          {/* =================================================
              ANALYTIC SECTIONS
          ================================================== */}

          <div className="mt-7 grid gap-5 xl:grid-cols-2">

            {/* ALERT SEVERITY */}

            <AnalyticsSection
              title="Alerts by Severity"
              description="Distribution from actual alert records."
              delay={300}
            >
              {Object.keys(
                alertSeverityCounts
              ).length === 0 ? (
                <p className="py-7 text-center text-xs text-slate-400">
                  No alert data available.
                </p>
              ) : (
                Object.entries(
                  alertSeverityCounts
                )
                  .sort(
                    (a, b) =>
                      b[1] - a[1]
                  )
                  .map(
                    (
                      [
                        severity,
                        count,
                      ],
                      index
                    ) => (
                      <BarRow
                        key={
                          severity
                        }
                        label={
                          severity
                        }
                        value={
                          count
                        }
                        max={
                          maxSeverity
                        }
                        tone={
                          String(
                            severity
                          ).toLowerCase() ===
                          "critical"
                            ? "red"
                            : String(
                                  severity
                                ).toLowerCase() ===
                                "high"
                              ? "amber"
                              : "navy"
                        }
                        delay={
                          index *
                          70
                        }
                      />
                    )
                  )
              )}
            </AnalyticsSection>


            {/* ALERT TYPES */}

            <AnalyticsSection
              title="Alert Types"
              description="Most frequently recorded threat types."
              delay={360}
            >
              {Object.keys(
                alertTypeCounts
              ).length === 0 ? (
                <p className="py-7 text-center text-xs text-slate-400">
                  No alert data available.
                </p>
              ) : (
                Object.entries(
                  alertTypeCounts
                )
                  .sort(
                    (a, b) =>
                      b[1] - a[1]
                  )
                  .map(
                    (
                      [
                        type,
                        count,
                      ],
                      index
                    ) => (
                      <BarRow
                        key={
                          type
                        }
                        label={
                          type
                        }
                        value={
                          count
                        }
                        max={
                          maxAlertType
                        }
                        tone="blue"
                        delay={
                          index *
                          70
                        }
                      />
                    )
                  )
              )}
            </AnalyticsSection>


            {/* EVENTS BY TYPE */}

            <AnalyticsSection
              title="Events by Type"
              description="Event distribution from the event registry."
              delay={420}
            >
              {Object.keys(
                eventTypeCounts
              ).length === 0 ? (
                <p className="py-7 text-center text-xs text-slate-400">
                  No event data available.
                </p>
              ) : (
                Object.entries(
                  eventTypeCounts
                )
                  .sort(
                    (a, b) =>
                      b[1] - a[1]
                  )
                  .map(
                    (
                      [
                        type,
                        count,
                      ],
                      index
                    ) => (
                      <BarRow
                        key={
                          type
                        }
                        label={
                          type
                        }
                        value={
                          count
                        }
                        max={
                          maxEventType
                        }
                        tone="green"
                        delay={
                          index *
                          70
                        }
                      />
                    )
                  )
              )}
            </AnalyticsSection>


            {/* ALERT RESOLUTION */}

            <AnalyticsSection
              title="Alert Resolution"
              description="Current alert status distribution."
              delay={480}
            >
              <BarRow
                label="Active"
                value={
                  activeAlerts
                }
                max={Math.max(
                  activeAlerts,
                  resolvedAlerts,
                  1
                )}
                tone="red"
                delay={0}
              />

              <BarRow
                label="Resolved"
                value={
                  resolvedAlerts
                }
                max={Math.max(
                  activeAlerts,
                  resolvedAlerts,
                  1
                )}
                tone="green"
                delay={100}
              />
            </AnalyticsSection>

          </div>


          {/* =================================================
              CAMERA EVENT ACTIVITY
          ================================================== */}

          <section
            className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(7,20,38,0.05)] animate-[fadeUp_0.6s_ease-out_forwards] opacity-0"
            style={{
              animationDelay:
                "540ms",
            }}
          >

            <div className="border-b border-slate-200 px-5 py-5">

              <h2 className="text-base font-black tracking-tight text-[#0b192c]">
                Camera Event Activity
              </h2>

              <p className="mt-1 text-[10px] text-slate-400">
                Event volume grouped by camera ID.
              </p>

            </div>


            <div className="divide-y divide-slate-100">

              {cameras.length === 0 ? (

                <div className="px-5 py-12 text-center">

                  <p className="text-sm font-bold text-slate-700">
                    No camera data available.
                  </p>

                </div>

              ) : (

                cameras.map(
                  (
                    camera,
                    index
                  ) => (
                    <div
                      key={
                        camera.id
                      }
                      className="group flex flex-col gap-3 px-5 py-4 transition-all duration-200 hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between animate-[fadeUp_0.5s_ease-out_forwards] opacity-0"
                      style={{
                        animationDelay:
                          `${
                            580 +
                            index *
                              55
                          }ms`,
                      }}
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


                      <div className="flex items-center gap-3">

                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">

                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#071426] to-[#52708f] animate-[barGrow_0.8s_ease-out_forwards]"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  5,
                                  ((cameraEventCounts[
                                    camera.id
                                  ] || 0) /
                                    Math.max(
                                      ...Object.values(
                                        cameraEventCounts
                                      ),
                                      1
                                    )) *
                                    100
                                )
                              )}%`,
                              animationDelay:
                                `${
                                  index *
                                  55
                                }ms`,
                            }}
                          />

                        </div>

                        <span className="min-w-[62px] text-right font-mono text-[10px] font-bold text-slate-500">
                          {cameraEventCounts[
                            camera.id
                          ] || 0}{" "}
                          events
                        </span>

                      </div>

                    </div>
                  )
                )

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

          @keyframes barGrow {
            from {
              transform: scaleX(0);
              opacity: 0.35;
            }

            to {
              transform: scaleX(1);
              opacity: 1;
            }
          }
        `}
      </style>
    </>
  );
}
