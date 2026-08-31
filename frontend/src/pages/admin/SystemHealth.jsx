import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, RefreshCw } from "lucide-react";
import { apiRequest } from "../../services/api";

const REFRESH_INTERVAL = 10000;

function isOnline(status) {
  return String(status || "").trim().toLowerCase() === "online";
}

function normalizeCameras(payload) {
  if (Array.isArray(payload?.cameras)) return payload.cameras;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export default function SystemHealth() {
  const navigate = useNavigate();

  const [health, setHealth] = useState(null);
  const [cameras, setCameras] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [healthError, setHealthError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [lastChecked, setLastChecked] = useState(null);

  const loadSystemHealth = useCallback(async () => {
    setHealthError("");
    setCameraError("");

    try {
      /*
       * /health is the backend's root health endpoint.
       * apiRequest is used for the authenticated camera endpoint.
       */
      const healthResponse = await fetch("/health", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const healthPayload = await healthResponse
        .json()
        .catch(() => ({}));

      if (!healthResponse.ok) {
        throw new Error(
          healthPayload?.error ||
            healthPayload?.message ||
            `Health check failed (${healthResponse.status}).`
        );
      }

      setHealth(healthPayload);

      try {
        const cameraPayload = await apiRequest("/cameras");
        setCameras(normalizeCameras(cameraPayload));
      } catch (error) {
        console.error("Camera health error:", error);

        setCameraError(
          error instanceof Error
            ? error.message
            : "Unable to load camera status."
        );

        setCameras([]);
      }

      setLastChecked(new Date());
    } catch (error) {
      console.error("Backend health error:", error);

      setHealth(null);
      setHealthError(
        error instanceof Error
          ? error.message
          : "Unable to check system health."
      );
      setLastChecked(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("ibvap_token");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    loadSystemHealth();

    const interval = window.setInterval(
      loadSystemHealth,
      REFRESH_INTERVAL
    );

    return () => window.clearInterval(interval);
  }, [navigate, loadSystemHealth]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSystemHealth();
  };

  const onlineCount = useMemo(
    () => cameras.filter((camera) => isOnline(camera?.status)).length,
    [cameras]
  );

  const offlineCount = cameras.length - onlineCount;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">

        {/* Header */}
        <div className="mb-7 flex flex-col gap-4 border-b border-slate-300 pb-6 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-[#071426]"
            >
              <ArrowLeft size={14} />
              Administrator Dashboard
            </button>

            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#b87800]">
              Administration
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#071426]">
              System Health
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Monitor backend availability and registered CCTV camera status.
            </p>

            {lastChecked && (
              <p className="mt-2 text-[10px] font-mono text-slate-400">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 transition hover:border-[#071426] hover:text-[#071426] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* Backend health */}
        <section className="border border-slate-300 bg-white">

          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#b87800]">
              Backend Service
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-10">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Checking backend...
              </p>
            </div>
          ) : healthError ? (
            <div className="px-6 py-6">
              <p className="text-sm font-black text-red-700">
                Backend unavailable
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {healthError}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between px-6 py-6">

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center bg-slate-100 text-[#071426]">
                  <Activity size={18} />
                </div>

                <div>
                  <p className="text-sm font-black text-[#071426]">
                    {health?.service || "IBVAP backend"}
                  </p>

                  <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Root health endpoint
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />

                <span className="text-xs font-black uppercase tracking-wider text-green-700">
                  {health?.status || "ok"}
                </span>
              </div>

            </div>
          )}
        </section>

        {/* CCTV health */}
        <section className="mt-6 border border-slate-300 bg-white">

          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#b87800]">
                CCTV Network
              </p>

              <p className="mt-1 text-sm font-black text-[#071426]">
                Camera Status
              </p>
            </div>

            {!loading && !cameraError && (
              <p className="text-xs font-mono text-slate-500">
                {cameras.length} total · {onlineCount} online · {offlineCount} offline
              </p>
            )}
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Checking cameras...
              </p>
            </div>
          ) : cameraError ? (
            <div className="px-6 py-6">
              <p className="text-sm font-black text-red-700">
                Camera status unavailable
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {cameraError}
              </p>
            </div>
          ) : cameras.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-bold text-slate-600">
                No cameras registered
              </p>

              <p className="mt-1 text-xs text-slate-400">
                No camera records were returned by the backend.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">

              {cameras.map((camera) => {
                const online = isOnline(camera?.status);

                return (
                  <div
                    key={camera.id}
                    className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-black text-[#071426]">
                          {camera?.name || `Camera ${camera?.id ?? "—"}`}
                        </p>

                        <span className="text-[10px] font-mono text-slate-400">
                          ID {camera?.id ?? "—"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {camera?.location || "Location unavailable"}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${
                        online
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {camera?.status || "unknown"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
