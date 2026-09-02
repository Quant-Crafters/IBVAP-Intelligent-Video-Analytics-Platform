import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getAlerts,
  getCameras,
  getEvents,
} from "../services/api";


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


/* =========================================================
   SEVERITY BADGE
========================================================= */

function SeverityBadge({ severity }) {
  const value = String(severity || "").toLowerCase();

  const styles = {
    critical:
      "border-red-200 bg-red-50 text-red-700",

    high:
      "border-orange-200 bg-orange-50 text-orange-700",

    medium:
      "border-amber-200 bg-amber-50 text-amber-700",

    low:
      "border-blue-200 bg-blue-50 text-blue-700",
  };

  const dots = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-500",
    low: "bg-blue-500",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
        styles[value] ||
        "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <span
        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
          dots[value] || "bg-slate-400"
        }`}
      />

      {severity || "Unknown"}
    </span>
  );
}


/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const value = String(status || "").toLowerCase();

  const styles = {
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

  const dots = {
    active: "bg-red-500",
    acknowledged: "bg-blue-500",
    escalated: "bg-orange-500",
    false_alert: "bg-slate-400",
    resolved: "bg-emerald-500",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
        styles[value] ||
        "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <span
        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
          dots[value] || "bg-slate-400"
        }`}
      />

      {(status || "Unknown").replace("_", " ")}
    </span>
  );
}


/* =========================================================
   REPORT METRIC CARD
========================================================= */

function ReportMetric({
  label,
  value,
  description,
  theme = "navy",
  delay = 0,
}) {
  const themes = {
    navy: {
      card:
        "border-slate-200 bg-gradient-to-br from-white via-white to-slate-100",
      value: "text-[#071426]",
      line:
        "from-slate-400 via-slate-700 to-slate-400",
      glow:
        "hover:shadow-[0_18px_40px_rgba(15,23,42,0.12)]",
    },

    green: {
      card:
        "border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50",
      value: "text-emerald-600",
      line:
        "from-emerald-400 via-emerald-500 to-teal-300",
      glow:
        "hover:shadow-[0_18px_40px_rgba(16,185,129,0.14)]",
    },

    red: {
      card:
        "border-red-100 bg-gradient-to-br from-white via-white to-red-50",
      value: "text-red-600",
      line:
        "from-red-400 via-red-500 to-orange-300",
      glow:
        "hover:shadow-[0_18px_40px_rgba(239,68,68,0.14)]",
    },

    amber: {
      card:
        "border-amber-100 bg-gradient-to-br from-white via-white to-amber-50",
      value: "text-amber-600",
      line:
        "from-amber-400 via-orange-400 to-yellow-300",
      glow:
        "hover:shadow-[0_18px_40px_rgba(245,158,11,0.14)]",
    },
  };

  const current =
    themes[theme] || themes.navy;

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-xl border p-5",
        "shadow-[0_4px_16px_rgba(7,20,38,0.05)]",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1",
        current.card,
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
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${current.line}`}
      />

      {/* SOFT GLOW */}
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${current.line} opacity-[0.06] blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-[0.13]`}
      />

      <div className="relative">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>

        <p
          className={`mt-2 text-3xl font-black tracking-[-0.04em] ${current.value}`}
        >
          {value}
        </p>

        <p className="mt-1.5 text-[10px] font-medium text-slate-400">
          {description}
        </p>
      </div>

      {/* MOVING GLOSS LINE */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
        <div
          className={`h-full w-1/3 animate-[slideAccent_3s_ease-in-out_infinite] bg-gradient-to-r ${current.line} opacity-70`}
        />
      </div>
    </div>
  );
}


/* =========================================================
   REPORT SECTION
========================================================= */

function ReportSection({
  title,
  description,
  children,
  delay = 0,
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(7,20,38,0.05)] animate-[fadeUp_0.6s_ease-out_forwards] opacity-0"
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <h3 className="text-base font-black tracking-tight text-[#071426]">
          {title}
        </h3>

        <p className="mt-1 text-[10px] leading-5 text-slate-400">
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}


/* =========================================================
   REPORTS PAGE
========================================================= */

export default function Reports() {
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
     LOAD REPORT DATA
  ======================================================= */

  const loadReportData = useCallback(
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
          "Reports error:",
          err
        );

        setError(
          err?.message ||
            "Failed to load report data."
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
    loadReportData();
  }, [loadReportData]);


  /* =======================================================
     CALCULATIONS
  ======================================================= */

  const activeAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          String(
            alert.status || ""
          ).toLowerCase() ===
          "active"
      ),
    [alerts]
  );

  const criticalAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          String(
            alert.severity || ""
          ).toLowerCase() ===
          "critical"
      ),
    [alerts]
  );

  const highAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          String(
            alert.severity || ""
          ).toLowerCase() ===
          "high"
      ),
    [alerts]
  );

  const onlineCameras = useMemo(
    () =>
      cameras.filter(
        (camera) => {
          const status =
            String(
              camera?.status || ""
            ).toLowerCase();

          return (
            status === "online" ||
            status === "active" ||
            status === "running"
          );
        }
      ).length,
    [cameras]
  );

  const latestAlerts = useMemo(() => {
    return [...alerts]
      .sort(
        (a, b) =>
          new Date(
            b.timestamp
          ).getTime() -
          new Date(
            a.timestamp
          ).getTime()
      )
      .slice(0, 10);
  }, [alerts]);

  const reportDate =
    new Date().toLocaleString();


  /* =======================================================
     PRINT
  ======================================================= */

  const handlePrint = () => {
    window.print();
  };


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <>
        <div className="min-h-full bg-[#f3f5f8]">

          <div className="mx-auto flex min-h-[60vh] w-full max-w-[1450px] items-center justify-center px-5">

            <div className="text-center">

              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#071426]" />

              <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Preparing operational report
              </p>

              <p className="mt-2 text-[10px] text-slate-400">
                Collecting current surveillance data...
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

            @media print {
              body {
                background: white !important;
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

        <div className="mx-auto w-full max-w-[1450px] px-5 py-7 sm:px-7 lg:px-8 print:max-w-none print:px-0 print:py-0">

          {/* =================================================
              SCREEN HEADER
          ================================================== */}

          <div className="mb-7 flex flex-col gap-5 border-b border-slate-300 pb-6 md:flex-row md:items-end md:justify-between print:hidden">

            <div>

              <div className="mb-2 flex items-center gap-2">



              </div>

              <h1 className="text-3xl font-black tracking-[-0.03em] text-[#0b192c] lg:text-4xl">
                Reports
              </h1>

              <p className="mt-1.5 text-xs font-medium text-slate-400">
                Report generated from the current backend surveillance data.
              </p>

            </div>


            {/* ACTIONS */}

            <div className="flex items-center gap-3">

              <button
                type="button"
                onClick={() =>
                  loadReportData(true)
                }
                disabled={refreshing}
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#071426] hover:text-[#071426] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="rounded-lg border border-[#071426] bg-[#071426] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#10243c] hover:shadow-md"
              >
                Print Report
              </button>

            </div>

          </div>


          {/* =================================================
              ERROR
          ================================================== */}

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 shadow-sm print:hidden">

              <strong>
                Backend error:
              </strong>{" "}

              {error}

            </div>
          )}


          {/* =================================================
              REPORT DOCUMENT
          ================================================== */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(7,20,38,0.07)] print:rounded-none print:border-0 print:shadow-none">

            {/* =================================================
                GLOSSY REPORT HEADER
            ================================================== */}

            <div className="group relative overflow-hidden bg-[#071426] px-6 py-8 text-white transition-all duration-500 hover:shadow-[0_20px_55px_rgba(7,20,38,0.28)] sm:px-8 sm:py-9">

              {/* BLUE GLOW */}

              <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl transition-all duration-700 group-hover:scale-125 group-hover:bg-blue-400/20" />

              {/* CYAN GLOW */}

              <div className="pointer-events-none absolute -left-28 -bottom-32 h-80 w-80 rounded-full bg-cyan-500/5 blur-3xl transition-all duration-700 group-hover:scale-125 group-hover:bg-cyan-400/10" />

              {/* AMBER GLOW */}

              <div className="pointer-events-none absolute right-1/3 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-amber-400/5 blur-3xl transition-all duration-700 group-hover:bg-amber-300/10" />

              {/* GLOSS SWEEP */}

              <div className="pointer-events-none absolute -left-[35%] top-0 h-full w-[28%] -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent blur-md transition-transform duration-[1400ms] ease-out group-hover:translate-x-[500%]" />

              {/* BORDER GLOW */}

              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.07] transition-all duration-500 group-hover:ring-white/[0.15]" />

              {/* HEADER CONTENT */}

              <div className="relative z-10 flex flex-col justify-between gap-7 sm:flex-row">

                {/* LEFT */}

                <div className="min-w-0">



                  <h2 className="mt-3 max-w-4xl text-2xl font-black leading-tight tracking-[-0.025em] text-white transition-colors duration-300 group-hover:text-slate-50 sm:text-3xl">
                    IBVAP Operational Surveillance Report
                  </h2>

                  <p className="mt-2 text-xs text-slate-300 transition-colors duration-300 group-hover:text-slate-200">
                    Intelligent Border Video Analytics Platform
                  </p>

                </div>


                {/* RIGHT */}

                <div className="shrink-0 sm:text-right">

                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors duration-300 group-hover:text-slate-400">
                    Generated
                  </p>

                  <p className="mt-1 font-mono text-xs text-white">
                    {reportDate}
                  </p>

                  <div className="mt-3 flex items-center gap-2 sm:justify-end">

                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />



                  </div>

                </div>

              </div>


              {/* DIVIDER */}

              <div className="relative z-10 mt-7 h-px overflow-hidden bg-white/10">

                <div className="h-full w-1/4 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-70 animate-[reportGlow_3s_ease-in-out_infinite]" />

              </div>


              {/* META */}



            </div>


            {/* =================================================
                REPORT METRICS
            ================================================== */}

            <div className="grid gap-3 bg-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">

              <ReportMetric
                label="Cameras"
                value={cameras.length}
                description={`${onlineCameras} currently online`}
                theme="navy"
                delay={80}
              />

              <ReportMetric
                label="Events"
                value={events.length}
                description="Recorded event activity"
                theme="green"
                delay={140}
              />

              <ReportMetric
                label="Active Alerts"
                value={activeAlerts.length}
                description="Currently requiring attention"
                theme="red"
                delay={200}
              />

              <ReportMetric
                label="Critical Alerts"
                value={criticalAlerts.length}
                description="Highest severity records"
                theme="amber"
                delay={260}
              />

            </div>


            {/* =================================================
                REPORT CONTENT
            ================================================== */}

            <div className="space-y-6 p-5 sm:p-7">


              {/* =================================================
                  OPERATIONAL SUMMARY
              ================================================== */}

              <ReportSection
                title="Operational Summary"
                description="Current surveillance activity derived from backend records."
                delay={320}
              >

                <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">

                  {/* TOTAL ALERTS */}

                  <div className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:bg-white hover:shadow-md">

                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                      Total Alerts
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-[#071426]">
                      {alerts.length}
                    </p>

                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-700 animate-[barGrow_0.8s_ease-out_forwards]"
                        style={{
                          width:
                            alerts.length > 0
                              ? "100%"
                              : "0%",
                        }}
                      />
                    </div>

                  </div>


                  {/* HIGH SEVERITY */}

                  <div className="group rounded-xl border border-orange-100 bg-orange-50/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:bg-orange-50 hover:shadow-md">

                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-orange-700">
                      High Severity
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-orange-600">
                      {highAlerts.length}
                    </p>

                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-orange-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 animate-[barGrow_0.8s_ease-out_forwards]"
                        style={{
                          width:
                            alerts.length > 0
                              ? `${Math.min(
                                  100,
                                  (highAlerts.length /
                                    alerts.length) *
                                    100
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>

                  </div>


                  {/* RECORDED EVENTS */}

                  <div className="group rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-md">

                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                      Recorded Events
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-emerald-600">
                      {events.length}
                    </p>

                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full w-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 animate-[barGrow_0.8s_ease-out_forwards]"
                      />
                    </div>

                  </div>

                </div>

              </ReportSection>


              {/* =================================================
                  RECENT ALERTS
              ================================================== */}

              <ReportSection
                title="Recent Alerts"
                description="Latest alert records available from the backend."
                delay={400}
              >

                <div className="overflow-x-auto">

                  {latestAlerts.length === 0 ? (

                    <div className="px-5 py-14 text-center">

                      <p className="text-sm font-bold text-slate-700">
                        No alerts recorded
                      </p>

                      <p className="mt-2 text-xs text-slate-400">
                        The backend currently contains no alert records.
                      </p>

                    </div>

                  ) : (

                    <table className="w-full min-w-[800px]">

                      <thead className="bg-[#f8fafc]">

                        <tr className="border-b border-slate-200 text-left">

                          <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Type
                          </th>

                          <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Camera
                          </th>

                          <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Severity
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

                        {latestAlerts.map(
                          (
                            alert,
                            index
                          ) => (

                            <tr
                              key={
                                alert.id
                              }
                              className="group animate-[fadeUp_0.45s_ease-out_forwards] opacity-0 transition-colors duration-200 hover:bg-slate-50"
                              style={{
                                animationDelay:
                                  `${
                                    440 +
                                    index *
                                      45
                                  }ms`,
                              }}
                            >

                              <td className="px-5 py-4">

                                <div className="flex items-center gap-2">

                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
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

                                  <span className="text-sm font-bold text-[#071426]">
                                    {alert.type ||
                                      "Unknown Alert"}
                                  </span>

                                </div>

                              </td>


                              <td className="px-5 py-4 text-xs font-semibold text-slate-500">
                                #{alert.camera_id}
                              </td>


                              <td className="px-5 py-4">

                                <SeverityBadge
                                  severity={
                                    alert.severity
                                  }
                                />

                              </td>


                              <td className="px-5 py-4">

                                <StatusBadge
                                  status={
                                    alert.status
                                  }
                                />

                              </td>


                              <td className="px-5 py-4 text-[10px] font-mono text-slate-400">
                                {formatTimestamp(
                                  alert.timestamp
                                )}
                              </td>

                            </tr>

                          )
                        )}

                      </tbody>

                    </table>

                  )}

                </div>

              </ReportSection>

            </div>


            {/* =================================================
                REPORT FOOTER
            ================================================== */}

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-center sm:px-8">



            </div>

          </div>

        </div>

      </div>


      {/* =====================================================
          ANIMATIONS + PRINT
      ====================================================== */}

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

          @keyframes reportGlow {
            0% {
              transform: translateX(-180%);
            }

            50% {
              transform: translateX(260%);
            }

            100% {
              transform: translateX(520%);
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

          @media print {
            body {
              background: white !important;
            }

            button {
              display: none !important;
            }

            section,
            tr,
            .animate-\\[fadeUp_0\\.55s_ease-out_forwards\\],
            .animate-\\[fadeUp_0\\.6s_ease-out_forwards\\] {
              animation: none !important;
              opacity: 1 !important;
              transform: none !important;
            }
          }
        `}
      </style>
    </>
  );
}
