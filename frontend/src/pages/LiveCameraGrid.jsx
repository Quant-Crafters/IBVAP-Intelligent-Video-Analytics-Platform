import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";

function getCameraName(camera) {
  return camera?.name || `Camera ${camera?.id ?? "—"}`;
}

function getCameraLocation(camera) {
  return camera?.location || "Location unavailable";
}

function isCameraOnline(camera) {
  const status = String(camera?.status || "")
    .trim()
    .toLowerCase();

  return (
    status === "online" ||
    status === "active" ||
    status === "running"
  );
}

function isBrowserPlayableStream(url) {
  const value = String(url || "").trim().toLowerCase();

  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:")
  );
}

/* ============================================================
   CAMERA CARD
============================================================ */

function CameraCard({ camera, index }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const name = getCameraName(camera);
  const location = getCameraLocation(camera);
  const online = isCameraOnline(camera);
  const streamPlayable = isBrowserPlayableStream(
    camera?.stream_url
  );

  return (
    <>
      <article
        className={[
          "group relative overflow-hidden rounded-2xl border bg-white",
          "shadow-[0_4px_18px_rgba(7,20,38,0.06)]",
          "transition-all duration-500 ease-out",
          "hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(7,20,38,0.12)]",
          "animate-[fadeUp_0.55s_ease-out_forwards]",
          "opacity-0",
          online
            ? "border-slate-200"
            : "border-red-200",
        ].join(" ")}
        style={{
          animationDelay: `${index * 90}ms`,
        }}
      >
        {/* TOP ACCENT */}
        <div
          className={`absolute inset-x-0 top-0 z-20 h-[3px] ${
            online
              ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-300"
              : "bg-gradient-to-r from-red-400 via-red-500 to-red-300"
          }`}
        />

        {/* VIDEO */}
        <div className="relative aspect-[16/9] overflow-hidden bg-[#061323]">
          {/* Soft moving background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(80,105,130,0.20),transparent_58%)]" />

          <div className="absolute inset-0 opacity-0 transition duration-700 group-hover:opacity-100">
            <div className="absolute -left-1/3 top-0 h-full w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent blur-md transition-transform duration-1000 group-hover:translate-x-[420%]" />
          </div>

          {streamPlayable && !videoFailed ? (
            <video
              src={camera.stream_url}
              autoPlay
              muted
              playsInline
              controls={false}
              onError={() => setVideoFailed(true)}
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-7 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
                {online
                  ? "Live Feed Unavailable"
                  : "Camera Offline"}
              </p>

              <p className="mt-3 max-w-sm text-[10px] leading-5 text-slate-400">
                {online
                  ? camera?.stream_url
                    ? "The registered stream is not directly playable in the browser."
                    : "No stream URL is registered for this camera."
                  : "This camera is currently unreachable."}
              </p>
            </div>
          )}

          {/* TOP INFORMATION */}
          <div className="absolute inset-x-0 top-0 z-10">
            <div className="h-24 bg-gradient-to-b from-black/90 via-black/40 to-transparent" />

            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-4 py-4">
              <div className="min-w-0 pr-3">
                <p className="truncate text-[12px] font-black uppercase tracking-[0.08em] text-white">
                  {name}
                </p>

                <p className="mt-1 truncate text-[9px] font-mono uppercase tracking-wider text-slate-300">
                  {location}
                </p>
              </div>

              <span
                className={[
                  "shrink-0 rounded-full px-3 py-1.5",
                  "text-[8px] font-bold uppercase tracking-[0.15em]",
                  "backdrop-blur-md",
                  online
                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                    : "bg-red-500/15 text-red-300 ring-1 ring-red-400/30",
                ].join(" ")}
              >
                <span
                  className={[
                    "mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle",
                    online
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-red-400",
                  ].join(" ")}
                />
                {online ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          {/* VIEW */}
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="absolute bottom-4 right-4 z-10 rounded-lg border border-white/15 bg-[#071426]/80 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.15em] text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-[#0d2038] hover:border-white/30 hover:scale-105"
          >
            View
          </button>
        </div>

        {/* INFORMATION */}
        <div className="relative px-4 py-4">
          <div
            className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full ${
              online
                ? "bg-emerald-500"
                : "bg-red-500"
            }`}
          />

          <div className="flex items-start justify-between gap-4 pl-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight text-[#071426]">
                {name}
              </p>

              <p className="mt-1 truncate text-[10px] font-medium text-slate-500">
                {location}
              </p>
            </div>

            <span
              className={`shrink-0 text-[8px] font-bold uppercase tracking-[0.14em] ${
                online
                  ? "text-emerald-600"
                  : "text-red-500"
              }`}
            >
              {online ? "Operational" : "Offline"}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 pl-2">
            <span className="text-[8px] font-mono uppercase tracking-[0.16em] text-slate-400">
              Camera ID
            </span>

            <span className="text-[9px] font-mono font-semibold text-slate-500">
              {camera?.id ?? "—"}
            </span>
          </div>
        </div>
      </article>

      {/* FULLSCREEN VIEWER */}
      {viewerOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020817]/90 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setViewerOpen(false)}
        >
          <div
            className="relative w-full max-w-7xl overflow-hidden rounded-2xl border border-slate-700 bg-[#071426] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-x-0 top-0 z-20">
              <div className="h-28 bg-gradient-to-b from-black/90 to-transparent" />

              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-5 py-5 sm:px-7">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black uppercase tracking-[0.08em] text-white">
                    {name}
                  </p>

                  <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                    {location}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setViewerOpen(false)}
                  className="shrink-0 rounded-lg border border-white/15 bg-black/50 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md transition hover:bg-black/80"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="aspect-video bg-[#061323]">
              {streamPlayable && !videoFailed ? (
                <video
                  src={camera.stream_url}
                  autoPlay
                  muted
                  playsInline
                  controls
                  onError={() => setVideoFailed(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-8 text-center">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.14em] text-white">
                      Stream Cannot Be Played
                    </p>

                    <p className="mx-auto mt-3 max-w-lg text-xs leading-6 text-slate-400">
                      {camera?.stream_url ||
                        "No stream URL is available for this camera."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
  delay = 0,
}) {
  const styles = {
    neutral: {
      wrapper:
        "border-slate-200 bg-gradient-to-br from-white via-white to-slate-50",
      value: "text-[#071426]",
      accent:
        "from-slate-400 via-slate-500 to-slate-300",
      glow: "shadow-[0_8px_30px_rgba(71,85,105,0.08)]",
    },

    success: {
      wrapper:
        "border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/80",
      value: "text-emerald-600",
      accent:
        "from-emerald-400 via-emerald-500 to-teal-300",
      glow: "shadow-[0_8px_30px_rgba(16,185,129,0.10)]",
    },

    danger: {
      wrapper:
        "border-red-100 bg-gradient-to-br from-white via-white to-red-50/80",
      value: "text-red-600",
      accent:
        "from-red-400 via-red-500 to-orange-300",
      glow: "shadow-[0_8px_30px_rgba(239,68,68,0.10)]",
    },

    warning: {
      wrapper:
        "border-amber-100 bg-gradient-to-br from-white via-white to-amber-50/80",
      value: "text-amber-600",
      accent:
        "from-amber-400 via-orange-400 to-yellow-300",
      glow: "shadow-[0_8px_30px_rgba(245,158,11,0.10)]",
    },
  };

  const current =
    styles[tone] || styles.neutral;

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-xl border p-5",
        "transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-lg",
        current.wrapper,
        current.glow,
        "animate-[fadeUp_0.5s_ease-out_forwards]",
        "opacity-0",
      ].join(" ")}
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      {/* TOP LINE */}
      <div
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${current.accent}`}
      />

      {/* SOFT GLOW */}
      <div
        className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${current.accent} opacity-[0.07] blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-[0.12]`}
      />

      <div className="relative">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>

        <p
          className={`mt-2 text-3xl font-black tracking-tight ${current.value}`}
        >
          {value}
        </p>

        <p className="mt-1 text-[10px] font-medium text-slate-400">
          {detail}
        </p>
      </div>

      {/* ANIMATED ACCENT */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden opacity-60">
        <div
          className={`h-full w-1/3 animate-[slideAccent_2.8s_ease-in-out_infinite] bg-gradient-to-r ${current.accent}`}
        />
      </div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
============================================================ */

export default function LiveCameraGrid() {
  const navigate = useNavigate();

  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [sortBy, setSortBy] =
    useState("name");

  const [viewMode, setViewMode] =
    useState("grid");

  /* ==========================================================
     LOAD DATA
  ========================================================== */

  const loadData = useCallback(async () => {
    setErrorMessage("");

    try {
      const [cameraResponse, alertResponse] =
        await Promise.allSettled([
          apiRequest("/cameras"),
          apiRequest("/alerts"),
        ]);

      if (cameraResponse.status === "rejected") {
        throw cameraResponse.reason;
      }

      const cameraData =
        cameraResponse.value;

      const alertData =
        alertResponse.status === "fulfilled"
          ? alertResponse.value
          : null;

      const nextCameras =
        Array.isArray(cameraData?.cameras)
          ? cameraData.cameras
          : Array.isArray(cameraData)
            ? cameraData
            : [];

      const nextAlerts =
        Array.isArray(alertData?.alerts)
          ? alertData.alerts
          : Array.isArray(alertData)
            ? alertData
            : [];

      setCameras(nextCameras);
      setAlerts(nextAlerts);
    } catch (error) {
      console.error(
        "Live camera grid error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load camera data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const token =
      localStorage.getItem("ibvap_token");

    if (!token) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    loadData();
  }, [loadData, navigate]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  /* ==========================================================
     COUNTERS
  ========================================================== */

  const totalCameras =
    cameras.length;

  const onlineCameras = useMemo(
    () =>
      cameras.filter((camera) =>
        isCameraOnline(camera)
      ).length,
    [cameras]
  );

  const offlineCameras =
    totalCameras - onlineCameras;

  const activeAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        const status = String(
          alert?.status || ""
        )
          .trim()
          .toLowerCase();

        return ![
          "resolved",
          "closed",
          "dismissed",
          "inactive",
        ].includes(status);
      }).length,
    [alerts]
  );

  /* ==========================================================
     FILTER + SORT
  ========================================================== */

  const filteredCameras = useMemo(() => {
    const query =
      searchQuery
        .trim()
        .toLowerCase();

    const result =
      cameras.filter((camera) => {
        const name =
          getCameraName(camera)
            .toLowerCase();

        const location =
          getCameraLocation(camera)
            .toLowerCase();

        const status =
          String(
            camera?.status || ""
          ).toLowerCase();

        const matchesSearch =
          !query ||
          name.includes(query) ||
          location.includes(query) ||
          status.includes(query);

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "online" &&
            isCameraOnline(camera)) ||
          (statusFilter === "offline" &&
            !isCameraOnline(camera));

        return (
          matchesSearch &&
          matchesStatus
        );
      });

    return [...result].sort(
      (a, b) => {
        if (sortBy === "status") {
          return String(
            a?.status || ""
          )
            .toLowerCase()
            .localeCompare(
              String(
                b?.status || ""
              ).toLowerCase()
            );
        }

        if (sortBy === "id") {
          return (
            Number(a?.id || 0) -
            Number(b?.id || 0)
          );
        }

        return getCameraName(a)
          .toLowerCase()
          .localeCompare(
            getCameraName(b)
              .toLowerCase()
          );
      }
    );
  }, [
    cameras,
    searchQuery,
    statusFilter,
    sortBy,
  ]);

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-900">

      <main className="mx-auto max-w-[1650px] px-6 py-7 lg:px-8 xl:px-10">

        {/* ====================================================
            PAGE HEADER
        ===================================================== */}

       {/* ====================================================
    PAGE HEADER
===================================================== */}

<div className="mb-8 border-b border-slate-300 pb-7">
  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

    {/* TITLE + SUBTITLE */}
    <div className="min-w-0">
      <h1 className="text-3xl font-black tracking-[-0.03em] text-[#071426] lg:text-4xl">
        Live Camera Grid
      </h1>

      <p className="mt-1.5 text-xs font-medium text-slate-400">
        Live CCTV feeds from cameras registered in IBVAP.
      </p>
    </div>

    {/* ACTION BUTTONS */}
    <div className="flex shrink-0 items-center gap-3">

      {/* RETURN */}
      <button
        type="button"
        onClick={() => navigate("/live-overview")}
        className="group inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#071426] hover:bg-[#071426] hover:text-white hover:shadow-md"
      >
        <span className="text-sm transition-transform duration-200 group-hover:-translate-x-1">
          ←
        </span>

        Return to Live Overview
      </button>

      {/* REFRESH */}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#071426] hover:text-[#071426] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        {refreshing ? "Refreshing..." : "Refresh"}
      </button>

    </div>
  </div>
</div>

        {/* ====================================================
            LOADING
        ===================================================== */}

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#071426]" />

              <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Loading surveillance network
              </p>

              <p className="mt-2 text-[10px] text-slate-400">
                Fetching registered camera data...
              </p>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="flex min-h-[350px] items-center justify-center rounded-2xl border border-red-200 bg-white px-6 text-center shadow-sm">
            <div>
              <p className="text-sm font-black text-red-700">
                Camera data unavailable
              </p>

              <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={handleRefresh}
                className="mt-5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition hover:border-[#071426]"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* =================================================
                SUMMARY + FILTER
            ================================================== */}

            <div className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">

              {/* FOUR SUMMARY CARDS ONLY */}
              <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total Cameras"
                  value={totalCameras}
                  detail="Registered in system"
                  tone="neutral"
                  delay={0}
                />

                <StatCard
                  label="Cameras Online"
                  value={onlineCameras}
                  detail="Live and reachable"
                  tone="success"
                  delay={70}
                />

                <StatCard
                  label="Cameras Offline"
                  value={offlineCameras}
                  detail="Not currently reachable"
                  tone="danger"
                  delay={140}
                />

                <StatCard
                  label="Active Alerts"
                  value={activeAlerts}
                  detail="Across all cameras"
                  tone="warning"
                  delay={210}
                />
              </section>

              {/* FILTER PANEL */}
              <section
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-[fadeUp_0.55s_ease-out_forwards] opacity-0"
                style={{
                  animationDelay: "120ms",
                }}
              >
                <div className="space-y-3">

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(
                        event.target.value
                      )
                    }
                    placeholder="Search cameras..."
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-[#071426] focus:ring-2 focus:ring-slate-200"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">

                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value
                        )
                      }
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 outline-none transition focus:border-[#071426]"
                    >
                      <option value="all">
                        All Status
                      </option>

                      <option value="online">
                        Online
                      </option>

                      <option value="offline">
                        Offline
                      </option>
                    </select>

                    <select
                      value={sortBy}
                      onChange={(event) =>
                        setSortBy(
                          event.target.value
                        )
                      }
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 outline-none transition focus:border-[#071426]"
                    >
                      <option value="name">
                        Sort: Camera Name
                      </option>

                      <option value="status">
                        Sort: Status
                      </option>

                      <option value="id">
                        Sort: Camera ID
                      </option>
                    </select>

                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">

                    <p className="text-[8px] font-mono uppercase tracking-[0.16em] text-slate-400">
                      Showing{" "}
                      {filteredCameras.length}{" "}
                      of{" "}
                      {totalCameras}
                    </p>

                    <div className="flex rounded-lg border border-slate-300 bg-slate-50 p-1">

                      <button
                        type="button"
                        onClick={() =>
                          setViewMode(
                            "grid"
                          )
                        }
                        className={[
                          "rounded-md px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all",
                          viewMode === "grid"
                            ? "bg-[#071426] text-white shadow-sm"
                            : "text-slate-500 hover:text-[#071426]",
                        ].join(" ")}
                      >
                        Grid
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setViewMode(
                            "list"
                          )
                        }
                        className={[
                          "rounded-md px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all",
                          viewMode === "list"
                            ? "bg-[#071426] text-white shadow-sm"
                            : "text-slate-500 hover:text-[#071426]",
                        ].join(" ")}
                      >
                        List
                      </button>

                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* =================================================
                CCTV HEADER
            ================================================== */}

            <section>

              <div className="mb-5 flex flex-col gap-3 border-b border-slate-300 pb-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h2 className="text-xl font-black tracking-tight text-[#071426]">
                    Live CCTV
                  </h2>

                  <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.16em] text-slate-400">
                    {filteredCameras.length}{" "}
                    Cameras
                  </p>
                </div>

                <div className="flex items-center gap-5 text-[9px] font-mono uppercase tracking-[0.14em]">

                  <span className="text-emerald-600">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />

                    {onlineCameras}{" "}
                    Online
                  </span>

                  <span className="text-red-500">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />

                    {offlineCameras}{" "}
                    Offline
                  </span>

                </div>
              </div>

              {/* =================================================
                  EMPTY STATE
              ================================================== */}

              {filteredCameras.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
                  <p className="text-sm font-black text-[#071426]">
                    No cameras found
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Try changing your search or status filter.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter(
                        "all"
                      );
                    }}
                    className="mt-5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition hover:border-[#071426] hover:text-[#071426]"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : viewMode === "grid" ? (

                /* =================================================
                   GRID
                ================================================== */

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

                  {filteredCameras.map(
                    (
                      camera,
                      index
                    ) => (
                      <CameraCard
                        key={
                          camera.id
                        }
                        camera={
                          camera
                        }
                        index={
                          index
                        }
                      />
                    )
                  )}

                </div>
              ) : (

                /* =================================================
                   LIST
                ================================================== */

                <div className="grid gap-4">

                  {filteredCameras.map(
                    (
                      camera,
                      index
                    ) => (
                      <CameraCard
                        key={
                          camera.id
                        }
                        camera={
                          camera
                        }
                        index={
                          index
                        }
                      />
                    )
                  )}

                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ========================================================
          PAGE ANIMATION CSS
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
              transform: translateX(-160%);
            }

            50% {
              transform: translateX(180%);
            }

            100% {
              transform: translateX(350%);
            }
          }
        `}
      </style>
    </div>
  );
}
