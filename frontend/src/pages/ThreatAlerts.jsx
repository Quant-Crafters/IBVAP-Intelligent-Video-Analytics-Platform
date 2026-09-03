import { useCallback, useEffect, useMemo, useState } from "react";

import { getAlerts } from "../services/api";


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
      <span
        className={`mr-1.5 h-1.5 w-1.5 self-center rounded-full ${
          value === "critical"
            ? "bg-red-500"
            : value === "high"
              ? "bg-orange-500"
              : value === "medium"
                ? "bg-amber-500"
                : value === "low"
                  ? "bg-blue-500"
                  : "bg-slate-400"
        }`}
      />

      {severity || "unknown"}
    </span>
  );
}


/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const value = String(status || "").toLowerCase();

  const classes = {
    active:
      "border-red-200 bg-red-50 text-red-700",

    acknowledged:
      "border-blue-200 bg-blue-50 text-blue-700",

    escalated:
      "border-orange-200 bg-orange-50 text-orange-700",

    false_alert:
      "border-slate-200 bg-slate-50 text-slate-500",

    resolved:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  const dotClasses = {
    active: "bg-red-500",
    acknowledged: "bg-blue-500",
    escalated: "bg-orange-500",
    false_alert: "bg-slate-400",
    resolved: "bg-emerald-500",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
        classes[value] ||
        "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <span
        className={`mr-1.5 h-1.5 w-1.5 self-center rounded-full ${
          dotClasses[value] || "bg-slate-400"
        }`}
      />

      {(status || "unknown").replace("_", " ")}
    </span>
  );
}


/* =========================================================
   TIMESTAMP
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

function formatConfidence(val) {
  if (val === undefined || val === null || val === "") return "—";
  const num = Number(val);
  if (Number.isNaN(num)) return "—";
  const pct = num > 0 && num <= 1.0 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
}


/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  description,
  theme,
  delay,
}) {
  const themes = {
    red: {
      wrapper:
        "border-red-100 bg-gradient-to-br from-white via-white to-red-50",
      value: "text-red-600",
      accent:
        "from-red-400 via-red-500 to-orange-300",
      glow:
        "hover:shadow-[0_18px_38px_rgba(239,68,68,0.12)]",
    },

    orange: {
      wrapper:
        "border-orange-100 bg-gradient-to-br from-white via-white to-orange-50",
      value: "text-orange-600",
      accent:
        "from-orange-400 via-orange-500 to-amber-300",
      glow:
        "hover:shadow-[0_18px_38px_rgba(249,115,22,0.12)]",
    },

    navy: {
      wrapper:
        "border-slate-200 bg-gradient-to-br from-white via-white to-slate-100",
      value: "text-[#071426]",
      accent:
        "from-slate-500 via-slate-700 to-slate-400",
      glow:
        "hover:shadow-[0_18px_38px_rgba(15,23,42,0.10)]",
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
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${current.accent} opacity-[0.06] blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-[0.13]`}
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
   MAIN COMPONENT
========================================================= */

export default function ThreatAlerts() {
  const [alerts, setAlerts] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [severityFilter, setSeverityFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");


  /* =======================================================
     LOAD ALERTS
  ======================================================= */

  const loadAlerts = useCallback(
    async (manual = false, isInitial = false) => {
      try {
        if (manual) {
          setRefreshing(true);
        } else if (isInitial) {
          setLoading(true);
        }

        setError("");

        const data = await getAlerts();

        setAlerts(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (err) {
        console.error(
          "Threat Alerts error:",
          err
        );

        setError(
          err?.message ||
            "Failed to load alerts."
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
    const initialLoad = window.setTimeout(() => loadAlerts(false, true), 0);

    const interval = setInterval(() => {
      loadAlerts(false, false);
    }, 5000);

    return () => {
      window.clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadAlerts]);


  /* =======================================================
     FILTERED ALERTS
  ======================================================= */

  const filteredAlerts = useMemo(() => {
    return [...alerts]
      .filter((alert) => {
        const severityMatch =
          severityFilter === "all" ||
          String(
            alert.severity || ""
          ).toLowerCase() ===
            severityFilter;

        const statusMatch =
          statusFilter === "all" ||
          String(
            alert.status || ""
          ).toLowerCase() ===
            statusFilter;

        return (
          severityMatch &&
          statusMatch
        );
      })
      .sort(
        (a, b) =>
          new Date(
            b.timestamp
          ).getTime() -
          new Date(
            a.timestamp
          ).getTime()
      );
  }, [
    alerts,
    severityFilter,
    statusFilter,
  ]);


  /* =======================================================
     SUMMARY
  ======================================================= */

  const activeCount = alerts.filter((alert) => {
    const st = String(alert?.status || "").toLowerCase();
    return st === "active" || st === "new" || st === "escalated";
  }).length;

  const criticalCount =
    alerts.filter(
      (alert) =>
        String(
          alert.severity || ""
        ).toLowerCase() ===
        "critical"
    ).length;

  const escalatedCount =
    alerts.filter(
      (alert) =>
        String(
          alert.status || ""
        ).toLowerCase() ===
        "escalated"
    ).length;


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
                Loading threat alerts
              </p>

              <p className="mt-2 text-[10px] text-slate-400">
                Fetching current alert data...
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
      <div className="min-h-full bg-[#f3f5f8] text-slate-900">

        <div className="mx-auto w-full max-w-[1450px] px-5 py-7 sm:px-7 lg:px-8">

          {/* =================================================
              HEADER
          ================================================== */}

          <div className="mb-7 flex flex-col gap-5 border-b border-slate-300 pb-6 md:flex-row md:items-end md:justify-between">

            <div>

              <div className="mb-2 flex items-center gap-2">



              </div>

              <h1 className="text-3xl font-black tracking-[-0.03em] text-[#0b192c] lg:text-4xl">
                Threat Alerts
              </h1>

              <p className="mt-1.5 text-xs font-medium text-slate-400">
                Review alerts generated and stored by the surveillance backend.
              </p>

            </div>


            {/* REFRESH */}

            <button
              type="button"
              onClick={() =>
                loadAlerts(true)
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
              BACKEND ERROR
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
              SUMMARY CARDS
          ================================================== */}

          <div className="grid gap-4 md:grid-cols-3">

            <SummaryCard
              label="Active Alerts"
              value={activeCount}
              description="Currently requiring attention"
              theme="red"
              delay={0}
            />

            <SummaryCard
              label="Critical Alerts"
              value={criticalCount}
              description="Highest severity records"
              theme="orange"
              delay={80}
            />

            <SummaryCard
              label="Escalated"
              value={escalatedCount}
              description="Escalated for command review"
              theme="navy"
              delay={160}
            />

          </div>


          {/* =================================================
              FILTERS
          ================================================== */}

          <section
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(7,20,38,0.05)] animate-[fadeUp_0.6s_ease-out_forwards] opacity-0"
            style={{
              animationDelay: "220ms",
            }}
          >

            <div className="mb-4">

              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                Filter Alert Registry
              </p>

              <p className="mt-1 text-[10px] text-slate-400">
                Narrow alerts by severity and current status.
              </p>

            </div>


            <div className="grid gap-4 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Severity
                </label>

                <select
                  value={severityFilter}
                  onChange={(event) =>
                    setSeverityFilter(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-xs font-medium text-slate-600 outline-none transition-all focus:border-[#0b192c] focus:bg-white focus:ring-2 focus:ring-slate-100"
                >
                  <option value="all">
                    All Severities
                  </option>

                  <option value="critical">
                    Critical
                  </option>

                  <option value="high">
                    High
                  </option>

                  <option value="medium">
                    Medium
                  </option>

                  <option value="low">
                    Low
                  </option>
                </select>

              </div>


              <div>

                <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Status
                </label>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-xs font-medium text-slate-600 outline-none transition-all focus:border-[#0b192c] focus:bg-white focus:ring-2 focus:ring-slate-100"
                >
                  <option value="all">
                    All Statuses
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="acknowledged">
                    Acknowledged
                  </option>

                  <option value="escalated">
                    Escalated
                  </option>

                  <option value="resolved">
                    Resolved
                  </option>

                  <option value="false_alert">
                    False Alert
                  </option>
                </select>

              </div>

            </div>

          </section>


          {/* =================================================
              ALERT REGISTRY
          ================================================== */}

          <section
            className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(7,20,38,0.05)] animate-[fadeUp_0.6s_ease-out_forwards] opacity-0"
            style={{
              animationDelay: "300ms",
            }}
          >

            {/* TABLE HEADER */}

            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h2 className="text-base font-black tracking-tight text-[#0b192c]">
                  Alert Registry
                </h2>

                <p className="mt-1 text-[10px] text-slate-400">
                  {filteredAlerts.length} alert
                  {filteredAlerts.length === 1
                    ? ""
                    : "s"} matching current filters.
                </p>

              </div>

              <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-slate-400">
                Live Registry
              </div>

            </div>


            {/* EMPTY STATE */}

            {filteredAlerts.length === 0 ? (

              <div className="px-6 py-16 text-center">

                <div className="mx-auto h-px w-10 bg-emerald-400" />

                <p className="mt-5 text-sm font-black text-slate-700">
                  No matching alerts
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  No alerts match the currently selected filters.
                </p>

              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[900px]">

                  <thead className="bg-[#f8fafc]">

                    <tr className="border-b border-slate-200 text-left">

                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Alert
                      </th>

                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Camera
                      </th>

                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Severity
                      </th>

                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Confidence
                      </th>

                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Status
                      </th>

                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Timestamp
                      </th>

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-slate-100">

                    {filteredAlerts.map(
                      (alert, index) => (

                        <tr
                          key={alert.id}
                          className="group animate-[fadeUp_0.45s_ease-out_forwards] opacity-0 transition-colors duration-200 hover:bg-slate-50/80"
                          style={{
                            animationDelay:
                              `${340 + index * 45}ms`,
                          }}
                        >

                          {/* ALERT */}

                          <td className="px-5 py-4">

                            <div className="min-w-[230px]">

                              <div className="flex items-center gap-2">

                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    String(
                                      alert.severity ||
                                        ""
                                    ).toLowerCase() ===
                                      "critical"
                                      ? "bg-red-500 animate-pulse"
                                      : String(
                                            alert.severity ||
                                              ""
                                          ).toLowerCase() ===
                                          "high"
                                        ? "bg-orange-500"
                                        : String(
                                              alert.severity ||
                                                ""
                                            ).toLowerCase() ===
                                            "medium"
                                          ? "bg-amber-500"
                                          : "bg-blue-500"
                                  }`}
                                />

                                <p className="truncate text-sm font-bold text-[#0b192c]">
                                  {alert.type ||
                                    "Unknown Alert"}
                                </p>

                              </div>

                              {alert.evidence && (
                                <p className="mt-1.5 max-w-xs truncate text-[10px] text-slate-400">
                                  {alert.evidence}
                                </p>
                              )}

                            </div>

                          </td>


                          {/* CAMERA */}

                          <td className="px-5 py-4">

                            <span className="text-xs font-semibold text-slate-600">
                              Camera #
                              {alert.camera_id}
                            </span>

                          </td>


                          {/* SEVERITY */}

                          <td className="px-5 py-4">

                            <SeverityBadge
                              severity={
                                alert.severity
                              }
                            />

                          </td>


                          {/* CONFIDENCE */}

                          <td className="px-5 py-4">

                            <span className="font-mono text-xs font-semibold text-slate-600">
                              {formatConfidence(alert.confidence ?? alert.threat_score)}
                            </span>

                          </td>


                          {/* STATUS */}

                          <td className="px-5 py-4">

                            <StatusBadge
                              status={
                                alert.status
                              }
                            />

                          </td>


                          {/* TIMESTAMP */}

                          <td className="px-5 py-4">

                            <span className="whitespace-nowrap text-[10px] font-mono text-slate-400">
                              {formatTimestamp(
                                alert.timestamp
                              )}
                            </span>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

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
